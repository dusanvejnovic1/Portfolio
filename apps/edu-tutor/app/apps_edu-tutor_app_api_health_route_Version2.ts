import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasKey: Boolean(process.env.OPENAI_API_KEY),
    defaultModel: process.env.DEFAULT_MODEL || null,
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    timestamp: new Date().toISOString(),
  });
}