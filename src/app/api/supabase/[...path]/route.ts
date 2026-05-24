import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.SUPABASE_URL_INTERNAL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://173.249.36.76:8000'
const TIMEOUT = 30000

async function proxyRequest(req: NextRequest) {
  const path = req.nextUrl.pathname.replace('/api/supabase/', '')
  const searchParams = req.nextUrl.searchParams.toString()
  const targetUrl = `${SUPABASE_URL}/${path}${searchParams ? '?' + searchParams : ''}`

  const headers: Record<string, string> = {}
  // Forward Supabase-specific headers
  const forwardHeaders = ['apikey', 'authorization', 'content-type', 'prefer', 'accept']
  req.headers.forEach((value, key) => {
    if (forwardHeaders.includes(key.toLowerCase())) {
      headers[key] = value
    }
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)

  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
      signal: controller.signal,
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = await req.text()
    }

    const response = await fetch(targetUrl, fetchOptions)
    clearTimeout(timeoutId)

    const body = await response.arrayBuffer()

    const responseHeaders = new Headers()
    // Forward CORS and Supabase headers
    const responseForwardHeaders = [
      'content-type', 'access-control-allow-origin', 'access-control-allow-headers',
      'access-control-allow-methods', 'access-control-expose-headers',
      'x-total-count', 'content-range', 'location', 'link',
      'x-kong-request-id', 'x-kong-response-latency',
    ]
    response.headers.forEach((value, key) => {
      if (responseForwardHeaders.includes(key.toLowerCase())) {
        responseHeaders.set(key, value)
      }
    })

    return new NextResponse(body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 })
    }
    return NextResponse.json({ error: error.message }, { status: 502 })
  }
}

export async function GET(req: NextRequest) { return proxyRequest(req) }
export async function POST(req: NextRequest) { return proxyRequest(req) }
export async function PUT(req: NextRequest) { return proxyRequest(req) }
export async function PATCH(req: NextRequest) { return proxyRequest(req) }
export async function DELETE(req: NextRequest) { return proxyRequest(req) }
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
      'Access-Control-Max-Age': '86400',
    },
  })
}
