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
  updated_at: string
}

export interface Wallet {
  id: string
  user_id: string
  wallet_address: string
  verified_at: string
}

export interface RenderCounts {
  today: number
  limit: number
  resets_at: string
}
