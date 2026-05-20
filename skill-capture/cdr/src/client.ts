import "dotenv/config";
import { createPublicClient, createWalletClient, http, type Account } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CDRClient, initWasm } from "@piplabs/cdr-sdk";

export const RPC_URL = process.env.RPC_URL ?? "https://aeneid.storyrpc.io";
export const API_URL = process.env.API_URL ?? "http://172.192.41.96:1317";

let wasmReady = false;

export async function ensureWasm() {
  if (!wasmReady) {
    await initWasm();
    wasmReady = true;
  }
}

function accountFromEnv(key: string): Account {
  const raw = process.env[key];
  if (!raw?.trim()) {
    throw new Error(`${key} missing — copy cdr/.env.example to cdr/.env and fund an Aeneid wallet.`);
  }
  return privateKeyToAccount(`0x${raw.replace(/^0x/, "")}`);
}

export function createClientsFromPrivateKey(privateKeyHex: string) {
  const trimmed = privateKeyHex.trim().replace(/^0x/i, "");
  const account = privateKeyToAccount(`0x${trimmed}` as `0x${string}`);
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({
    account,
    transport: http(RPC_URL),
  });
  const client = new CDRClient({
    network: "testnet",
    publicClient,
    walletClient,
    apiUrl: API_URL,
  });
  return { account, publicClient, walletClient, client };
}

export function createClients(privateKeyEnv: "WALLET_PRIVATE_KEY" | "BUYER_PRIVATE_KEY" = "WALLET_PRIVATE_KEY") {
  const envKey =
    privateKeyEnv === "BUYER_PRIVATE_KEY" && process.env.BUYER_PRIVATE_KEY
      ? "BUYER_PRIVATE_KEY"
      : "WALLET_PRIVATE_KEY";
  const account = accountFromEnv(envKey);
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({
    account,
    transport: http(RPC_URL),
  });
  const client = new CDRClient({
    network: "testnet",
    publicClient,
    walletClient,
    apiUrl: API_URL,
  });
  return { account, publicClient, walletClient, client };
}
