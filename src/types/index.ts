// ─── Tier ────────────────────────────────────────────────────────────────────
export enum Tier {
  Free = "free",
  Holder = "holder",
  Pro = "pro",
}

// ─── User ────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  displayName: string;
  tier: Tier;
  walletAddress?: string; // Solana wallet (required for Holder tier)
  stripeCustomerId?: string;
  credits: number; // Pro tier credits
  createdAt: string;
  updatedAt: string;
}

// ─── Video ───────────────────────────────────────────────────────────────────
export interface Video {
  id: string;
  userId: string;
  sourceUrl: string; // the captured website URL
  title: string;
  status: VideoStatus;
  durationSeconds: number;
  resolution: string;
  outputUrl?: string; // R2 / CDN URL to the final video
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export enum VideoStatus {
  Queued = "queued",
  Capturing = "capturing",
  Rendering = "rendering",
  Enhancing = "enhancing",
  Complete = "complete",
  Failed = "failed",
}

// ─── Render ──────────────────────────────────────────────────────────────────
export interface Render {
  id: string;
  videoId: string;
  jobId: string; // BullMQ job ID
  framesTotal: number;
  framesComplete: number;
  style?: string; // cinematic preset
  engine: string; // "hyperframes" | "nvidia"
  startedAt: string;
  completedAt?: string;
}

// ─── API helpers ─────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}

export interface CaptureRequest {
  url: string;
  style?: string;
  resolution?: string;
  durationSeconds?: number;
}

export interface WalletVerifyResponse {
  walletAddress: string;
  tier: Tier;
  tokenBalance: number;
}
