import { Tier, TierLimits } from '@/types'

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    dailyRenders: 2,
    maxDuration: 15,
    styles: ['Cinematic', 'Minimal'],
  },
  holder: {
    dailyRenders: 10,
    maxDuration: 30,
    styles: ['Cinematic', 'Social Ad', 'Tutorial', 'Minimal'],
  },
  pro: {
    dailyRenders: Infinity,
    maxDuration: 60,
    styles: ['Cinematic', 'Social Ad', 'Tutorial', 'Minimal'],
  },
}

/**
 * Get all limits for a given tier.
 */
export function getTierLimits(tier: Tier): TierLimits {
  return TIER_LIMITS[tier]
}

/**
 * Check if the user can still render today given their tier limit and usage count.
 */
export function canRender(tier: Tier, usedToday: number): boolean {
  const limit = TIER_LIMITS[tier].dailyRenders
  return usedToday < limit
}

/**
 * Get the list of allowed video styles for a given tier.
 */
export function getAllowedStyles(tier: Tier): string[] {
  return TIER_LIMITS[tier].styles
}

/**
 * Get the maximum render duration in seconds for a given tier.
 */
export function getMaxDuration(tier: Tier): number {
  return TIER_LIMITS[tier].maxDuration
}
