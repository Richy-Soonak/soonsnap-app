import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/render
 * Processes a queued render job — stitches captured frames into a
 * cinematic video using the HyperFrames pipeline + NVIDIA AI.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { jobId } = body as { jobId?: string };

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  // TODO: pull job from BullMQ, run HyperFrames render pipeline
  return NextResponse.json({ status: "rendering", jobId });
}
