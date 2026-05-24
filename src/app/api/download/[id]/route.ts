import { NextRequest, NextResponse } from 'next/server'
import { existsSync, statSync, createReadStream, unlinkSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { Readable } from 'stream'
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-admin'
import type { Tier } from '@/types'

const VIDEOS_DIR = process.env.VIDEOS_DIR || '/tmp/soonsnap-videos'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Authenticate the user
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const version = searchParams.get('v')

  if (!version) {
    return NextResponse.json({ ok: false, error: 'Missing version parameter (?v=)' }, { status: 400 })
  }

  // 2. Look up the video file
  const filePath = join(VIDEOS_DIR, `${id}_v${version}.mp4`)

  if (!existsSync(filePath)) {
    return NextResponse.json({ ok: false, error: 'Video not found' }, { status: 404 })
  }

  // 3. Check user's tier from soonsnap_wallets
  const { data: wallet } = await supabaseAdmin
    .from('soonsnap_wallets')
    .select('tier')
    .eq('user_id', user.id)
    .single()

  const tier: Tier = wallet?.tier || 'free'

  // 4. Determine the filename for Content-Disposition
  const downloadName = `soonsnap_${id}_v${version}.mp4`

  // 5. If holder or pro, stream the clean file directly
  if (tier === 'holder' || tier === 'pro') {
    const stat = statSync(filePath)
    const fileStream = createReadStream(filePath)
    const webStream = Readable.toWeb(fileStream) as ReadableStream

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `attachment; filename="${downloadName}"`,
      },
    })
  }

  // 6. Free tier: add watermark via ffmpeg
  const tmpOutput = `/tmp/soonsnap_wm_${id}_v${version}_${Date.now()}.mp4`

  try {
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', filePath,
        '-vf', "drawtext=text='SoonSnap':fontsize=24:fontcolor=white@0.5:x=w-tw-10:y=h-th-10",
        '-c:a', 'copy',
        '-y',
        tmpOutput,
      ])

      let stderr = ''
      ffmpeg.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`))
        } else {
          resolve()
        }
      })

      ffmpeg.on('error', (err) => {
        reject(err)
      })
    })

    // Stream the watermarked file
    const stat = statSync(tmpOutput)
    const fileStream = createReadStream(tmpOutput)
    const webStream = Readable.toWeb(fileStream) as ReadableStream

    // Clean up the temp file after streaming
    fileStream.on('close', () => {
      try { unlinkSync(tmpOutput) } catch { /* ignore */ }
    })

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `attachment; filename="${downloadName}"`,
      },
    })
  } catch (err: any) {
    // Clean up temp file on error
    try { unlinkSync(tmpOutput) } catch { /* ignore */ }
    console.error('Watermark ffmpeg error:', err.message)
    return NextResponse.json(
      { ok: false, error: 'Failed to process video download' },
      { status: 500 }
    )
  }
}
