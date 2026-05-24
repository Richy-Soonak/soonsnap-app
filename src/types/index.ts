export type Tier = 'free' | 'holder' | 'pro'

export interface UserProfile {
  id: string
  email: string
  tier: Tier
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  url: string
  title: string
  status: 'capturing' | 'composing' | 'rendering' | 'complete' | 'failed'
  created_at: string
  updated_at: string
}

export interface Version {
  id: string
  project_id: string
  version_num: number
  prompt: string
  enhanced_prompt: string | null
  video_url: string | null
  thumbnail_url: string | null
  duration: number | null
  status: 'pending' | 'rendering' | 'complete' | 'failed'
  created_at: string
}

export interface CreditBalance {
  id: string
  user_id: string
  balance: number
  total_purchased: number
  total_used: number
  updated_at: string
}

export interface Wallet {
  id: string
  user_id: string
  wallet_address: string
  tier: Tier
  verified_at: string
  created_at: string
  updated_at: string
}

export interface StripeCustomer {
  id: string
  user_id: string
  stripe_customer_id: string
  subscription_id: string | null
  subscription_status: string | null
  created_at: string
  updated_at: string
}

export interface TierLimits {
  dailyRenders: number
  maxDuration: number
  styles: string[]
}

export interface RenderCounts {
  today: number
  limit: number
  resets_at: string
}

export interface WalletStatus {
  connected: boolean
  walletAddress: string | null
  tier: Tier
  soonakBalance: number
}

export interface WalletInfo {
  connected: boolean
  walletAddress: string | null
  tier: Tier
  soonakBalance: number
}

export interface CreditsStatus {
  balance: number
  totalPurchased: number
  totalUsed: number
  todayRenders: number
  dailyLimit: number
  tier: Tier
}

export interface CreditsInfo {
  balance: number
  totalPurchased: number
  totalUsed: number
  todayRenders: number
  dailyLimit: number
  tier: Tier
}
