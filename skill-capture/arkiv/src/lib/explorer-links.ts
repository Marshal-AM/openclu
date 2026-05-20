export const ARKIV_BRAGA_EXPLORER =
  process.env.ARKIV_EXPLORER_URL ?? "https://explorer.braga.hoodi.arkiv.network";

export function arkivTxUrl(txHash: string): string {
  const h = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
  return `${ARKIV_BRAGA_EXPLORER}/tx/${h}`;
}
