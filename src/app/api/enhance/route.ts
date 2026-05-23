/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server'

const NIM_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const NIM_MODEL = 'nvidia/llama-3.1-nemotron-nano-8b-v1'

export async function POST(req: NextRequest) {
  try {
    const { prompt, style, duration, siteTitle } = await req.json()

    if (!prompt) {
      return NextResponse.json({ ok: false, error: 'Missing prompt' }, { status: 400 })
    }

    const apiKey = process.env.NVIDIA_API_KEY
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'NVIDIA_API_KEY not configured' }, { status: 500 })
    }

    const systemPrompt = `You are a professional video production prompt engineer. Your job is to enhance a user's rough prompt into a detailed, production-ready brief for an AI video generator.

The video will be:
- Style: ${style || 'cinematic'}
- Duration: ${duration || 15} seconds
- For: ${siteTitle || 'a website'}
- Resolution: 1920x1080

Enhance the prompt by adding:
1. Specific scene descriptions (2-3 scenes that flow naturally)
2. Animation timing and transitions
3. Text overlay content
4. Color/mood direction
5. CTA (call-to-action) at the end

Keep it concise (max 200 words). Output ONLY the enhanced prompt, no preamble.`

    const response = await fetch(NIM_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: NIM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 512,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json({
        ok: false,
        error: `NIM API error: ${response.status}`,
      }, { status: 502 })
    }

    const data = await response.json()
    const enhancedPrompt = data.choices?.[0]?.message?.content || prompt

    return NextResponse.json({
      ok: true,
      enhancedPrompt: enhancedPrompt.trim(),
    })
  } catch (err: any) {
    console.error('Enhance error:', err.message)
    return NextResponse.json({
      ok: false,
      error: err.message || 'Enhance failed',
    }, { status: 500 })
  }
}
