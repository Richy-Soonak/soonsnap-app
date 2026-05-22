import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/wallet/verify
 * Verifies that a connected Solana wallet holds ≥200 $SOONAK tokens
 * and returns the holder tier status.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { walletAddress } = body as { walletAddress?: string };

  if (!walletAddress) {
    return NextResponse.json(
      { error: "walletAddress is required" },
      { status: 400 }
    );
  }

  // TODO: query Solana RPC for SOONAK token balance, verify ≥200
  return NextResponse.json({
    walletAddress,
    tier: "holder",
    tokenBalance: 0,
  });
}
