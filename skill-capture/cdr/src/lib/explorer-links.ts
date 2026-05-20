export const STORY_AENEID_EXPLORER =
  process.env.STORY_EXPLORER_URL ?? "https://aeneid.explorer.story.foundation";
export const IPFS_GATEWAY = process.env.IPFS_GATEWAY ?? "https://ipfs.io/ipfs";

export function storyIpaUrl(ipId: string): string {
  return `${STORY_AENEID_EXPLORER}/ipa/${ipId}`;
}

export function storyTxUrl(txHash: string): string {
  const h = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
  return `${STORY_AENEID_EXPLORER}/tx/${h}`;
}

export function storyAddressUrl(address: string): string {
  return `${STORY_AENEID_EXPLORER}/address/${address}`;
}

export function ipfsUrl(cidOrHash: string): string {
  const path = cidOrHash.replace(/^ipfs:\/\//, "");
  return `${IPFS_GATEWAY}/${path}`;
}
