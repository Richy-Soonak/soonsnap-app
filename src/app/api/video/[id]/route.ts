/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, statSync, existsSync } from 'fs'
import { join } from 'path'

const VIDEOS_DIR = process.env.VIDEOS_DIR || '/tmp/soonsnap-videos'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const version = searchParams.get('v')

  // Try version-specific file first, then fallback to project-level
  let filePath: string | null = null

  if (version) {
    const versioned = join(VIDEOS_DIR, `${id}_v${version}.mp4`)
    if (existsSync(versioned)) filePath = versioned
  }

  if (!filePath) {
    // Try to find latest version file
    const { execSync } = require('child_process')
    try {
      const files = execSync(`ls -t ${VIDEOS_DIR}/${id}_v*.mp4 2>/dev/null | head -1`, { encoding: 'utf-8' }).trim()
      if (files) filePath = files
    } catch {}
  }

  if (!filePath) {
    // Legacy fallback: project-level file
    const legacy = join(VIDEOS_DIR, `${id}.mp4`)
    if (existsSync(legacy)) filePath = legacy
  }

  if (!filePath || !existsSync(filePath)) {
    return NextResponse.json({ ok: false, error: 'Video not found' }, { status: 404 })
  }

  const stat = statSync(filePath)
  const range = req.headers.get('range')

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1
    const chunkSize = end - start + 1

    const buffer = Buffer.alloc(chunkSize)
    const fd = require('fs').openSync(filePath, 'r')
    require('fs').readSync(fd, buffer, 0, chunkSize, start)
    require('fs').closeSync(fd)

    return new NextResponse(buffer, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize.toString(),
        'Content-Type': 'video/mp4',
      },
    })
  }

  const buffer = readFileSync(filePath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size.toString(),
      'Accept-Ranges': 'bytes',
    },
  })
}
