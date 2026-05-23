/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const THUMBNAILS_DIR = process.env.THUMBNAILS_DIR || '/tmp/soonsnap-thumbnails'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const version = searchParams.get('v')

  if (!version) {
    return NextResponse.json({ ok: false, error: 'Missing ?v= version param' }, { status: 400 })
  }

  const filePath = join(THUMBNAILS_DIR, `${id}_v${version}.jpg`)

  if (!existsSync(filePath)) {
    return NextResponse.json({ ok: false, error: 'Thumbnail not found' }, { status: 404 })
  }

  const buffer = readFileSync(filePath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
