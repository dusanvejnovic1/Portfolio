'use client'

import React, { useState, useRef, useCallback } from "react";
import { fetchNDJSONStream } from "../lib/sse";

interface StreamState {
  isStreaming: boolean;
  days: any[];
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
        onMessage: (msg) => {
          if (!msg || typeof msg !== "object") {
            // Log if NDJSON line is not an object
            // eslint-disable-next-line no-console
            console.error("Received non-object NDJSON message:", msg);
            return;
          }
          if (msg.type === "day" && msg.day) {
            setState((prev) => ({
              ...prev,
              days: [...prev.days, msg.day],
              currentDay: prev.currentDay + 1,
              progress: `Day ${prev.currentDay + 1} generated`,
            }));
          } else if (msg.type === "done") {
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              progress: "Generation complete",
            }));
            if (onComplete) onComplete();
          } else if (msg.type === "error") {
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              error: msg.error || "Unknown error",
            }));
            if (onError) onError(msg.error || "Unknown error");
          }
        },
        onError: (err) => {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: err instanceof Error ? err.message : String(err),
          }));
          if (onError) onError(err instanceof Error ? err.message : String(err));
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
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: err instanceof Error ? err.message : String(err),
      }));
      if (onError) onError(err instanceof Error ? err.message : String(err));
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
