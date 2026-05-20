#!/usr/bin/env node
/**
 * Deterministic device wallet from DEVICE_SALT + DEVICE_ID (used by register.sh / register.ps1).
 */
import { createHash, randomBytes } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";

const salt = process.env.DEVICE_SALT || process.argv[2];
const deviceId = process.env.DEVICE_ID || process.argv[3];
if (!salt || !deviceId) {
  console.error("Usage: DEVICE_SALT=... DEVICE_ID=... node register-wallet.mjs");
  process.exit(1);
}
const seed = createHash("sha256").update(`${salt}:${deviceId}`).digest("hex");
const account = privateKeyToAccount(`0x${seed}`);
console.log(
  JSON.stringify({
    address: account.address,
    privateKey: `0x${seed}`,
  }),
);
