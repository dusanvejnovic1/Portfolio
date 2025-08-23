import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// In-memory store for demo purposes
const STORE: Record<string, Record<string, unknown>> = {}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    if (!body || typeof body.title !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
  const id = String(body.id || crypto.randomUUID())
    const now = new Date().toISOString()
    const saved = { ...body, id, savedAt: now }
  STORE[id] = saved as Record<string, unknown>
    return NextResponse.json(saved)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET() {
  const list = Object.values(STORE)
  return NextResponse.json({ items: list })
}
