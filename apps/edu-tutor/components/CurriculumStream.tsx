'use client';

import React, { useState, useRef, useCallback } from "react";
import { fetchNDJSONStream } from "../lib/sse";

// Define this type to match your actual data shape
export interface CurriculumDay {
  day: number;
  title: string;
  summary: string;
  goals: string[];
  theorySteps: string[];
  handsOnSteps: string[];
  resources: Array<{
    title: string;
    url: string;
    type: string;
  }>;
  assignment: string;
  checkForUnderstanding: string[];
  // Add other fields as needed!
}

type CurriculumStreamMessage =
  | { type: "day"; day: CurriculumDay }
  | { type: "done" }
  | { type: "error"; error: string };

interface StreamState {
  isStreaming: boolean;
  days: CurriculumDay[];
  progress: string;
  currentDay: number;
  totalDays: number;
  error?: string;
}

interface CurriculumStreamProps {
  request: {
    topic: string;
    level: string;
    durationDays: number;
    goals?: string[];
  };
  onComplete?: () => void;
  onError?: (error: string) => void;
}

const CurriculumStream: React.FC<CurriculumStreamProps> = ({
  request,
  onComplete,
  onError,
}) => {
  const [state, setState] = useState<StreamState>({
    isStreaming: false,
    days: [],
    progress: "",
    currentDay: 0,
    totalDays: request.durationDays,
    error: undefined,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const startGeneration = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState((prev) => ({
      ...prev,
      isStreaming: true,
      days: [],
      progress: "Starting generation...",
      currentDay: 0,
      error: undefined,
    }));

    try {
      await fetchNDJSONStream("/api/modes/curriculum/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
        onMessage: (msg: unknown) => {
          // Type guard for CurriculumStreamMessage
          if (typeof msg === "object" && msg !== null && "type" in msg) {
            const message = msg as CurriculumStreamMessage;
            if (message.type === "day") {
              setState((prev) => ({
                ...prev,
                days: [...prev.days, message.day],
                currentDay: prev.currentDay + 1,
                progress: `Day ${prev.currentDay + 1} generated`,
              }));
            } else if (message.type === "done") {
              setState((prev) => ({
                ...prev,
                isStreaming: false,
                progress: "Generation complete",
              }));
              if (onComplete) onComplete();
            } else if (message.type === "error") {
              setState((prev) => ({
                ...prev,
                isStreaming: false,
                error: message.error,
              }));
              if (onError) onError(message.error);
            }
          } else {
            // eslint-disable-next-line no-console
            console.error("Received non-object NDJSON message:", msg);
          }
        },
        onError: (err: unknown) => {
          const errorMsg =
            err instanceof Error ? err.message : String(err);
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: errorMsg,
          }));
          if (onError) onError(errorMsg);
        },
        onComplete: () => {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            progress: "Generation complete",
          }));
          if (onComplete) onComplete();
        },
      });
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: errorMsg,
      }));
      if (onError) onError(errorMsg);
    }
  }, [request, onComplete, onError]);

  return (
    <div>
      <button
        onClick={startGeneration}
        disabled={state.isStreaming}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {state.isStreaming ? "Generating..." : "Generate Curriculum"}
      </button>
      <div className="mt-4">
        {state.progress && (
          <div className="text-sm text-gray-700">{state.progress}</div>
        )}
        {state.error && <div className="text-red-700">{state.error}</div>}
        {state.days.length > 0 && (
          <div className="mt-2">
            <h3 className="font-semibold">Generated Days:</h3>
            <ul>
              {state.days.map((day, i) => (
                <li key={i} className="mb-2">
                  <pre className="p-2 bg-gray-100 rounded overflow-x-auto text-xs">
                    {JSON.stringify(day, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default CurriculumStream;
