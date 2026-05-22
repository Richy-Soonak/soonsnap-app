// Solana Web3.js helpers for $SOONAK token verification
// Install: npm install @solana/web3.js @solana/spl-token

const SOONAK_MINT = process.env.SOONAK_MINT ?? "H218TQViAXsSqwCLnf7L41zewUTRmdN1r4neLtjBXYXS";
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

/**
 * Returns the $SOONAK token balance for a given wallet address.
 * Returns 0 if the wallet has no associated token account.
 */
export async function getSoonakBalance(walletAddress: string): Promise<number> {
  // TODO: implement with @solana/web3.js + @solana/spl-token
  // 1. Create Connection(RPC_URL)
  // 2. Derive associated token account for SOONAK_MINT
  // 3. Fetch balance, convert from lamports with decimals
  console.log(SOONAK_MINT, RPC_URL, walletAddress);
  return 0;
}

/**
 * Checks whether a wallet qualifies for the Holder tier (≥200 SOONAK).
 */
export async function isHolder(walletAddress: string): Promise<boolean> {
  const balance = await getSoonakBalance(walletAddress);
  return balance >= 200;
}
