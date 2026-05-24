import { Connection, PublicKey } from '@solana/web3.js'
import { Tier } from '@/types'

const SOONAK_MINT = new PublicKey('H218TQViAXsSqwCLnf7L41zewUTRmdN1r4neLtjBXYXS')

/**
 * Returns the $SOONAK token balance for a given wallet address.
 * Uses Helius RPC and getTokenAccountsByOwner to find the associated token account.
 * Returns 0 if the wallet holds no $SOONAK tokens.
 */
export async function checkSoonakBalance(walletAddress: string): Promise<number> {
  const rpcUrl = process.env.HELIUS_RPC_URL
  if (!rpcUrl) {
    throw new Error('HELIUS_RPC_URL is not configured')
  }

  const connection = new Connection(rpcUrl, 'confirmed')

  try {
    const owner = new PublicKey(walletAddress)

    const tokenAccounts = await connection.getTokenAccountsByOwner(owner, {
      mint: SOONAK_MINT,
    })

    if (tokenAccounts.value.length === 0) {
      return 0
    }

    const tokenAccount = tokenAccounts.value[0].pubkey
    const balance = await connection.getTokenAccountBalance(tokenAccount)

    if (!balance.value) {
      return 0
    }

    // Token balances are returned in UI-compatible string format (already accounting for decimals)
    return parseFloat(balance.value.uiAmountString ?? '0')
  } catch (error) {
    console.error('Error checking SOONAK balance:', error)
    return 0
  }
}

/**
 * Determine the tier based on $SOONAK token balance.
 * Returns 'holder' if balance >= 200, otherwise 'free'.
 */
export function determineTier(balance: number): 'free' | 'holder' {
  return balance >= 200 ? 'holder' : 'free'
}
