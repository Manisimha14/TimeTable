import { NextResponse } from 'next/server'

// Use globalThis so serverless instances reuse memory across warm executions
const globalSyncStore = (globalThis as any).__syncStore || new Map<string, { data: any; timestamp: number }>()
;(globalThis as any).__syncStore = globalSyncStore

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')?.trim().toUpperCase()

  if (!code) {
    return NextResponse.json(
      { error: 'Sync code required' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
    )
  }

  const record = globalSyncStore.get(code)
  if (!record) {
    return NextResponse.json(
      { found: false },
      { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } },
    )
  }

  return NextResponse.json(
    { found: true, data: record.data, timestamp: record.timestamp },
    { headers: { 'Access-Control-Allow-Origin': '*' } },
  )
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { code, data } = body

    if (!code || !data) {
      return NextResponse.json(
        { error: 'Code and data required' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
      )
    }

    const cleanCode = String(code).trim().toUpperCase()
    const timestamp = Date.now()

    globalSyncStore.set(cleanCode, { data, timestamp })

    return NextResponse.json(
      { success: true, code: cleanCode, timestamp },
      { headers: { 'Access-Control-Allow-Origin': '*' } },
    )
  } catch {
    return NextResponse.json(
      { error: 'Failed to process sync request' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } },
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    },
  )
}
