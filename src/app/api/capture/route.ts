import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/capture
 * Accepts a URL and screenshots the page via headless browser,
 * then enqueues a render job in BullMQ.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url } = body as { url?: string };

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // TODO: validate URL, launch headless capture, enqueue render job
  return NextResponse.json({ status: "queued", url });
}
