import {
  decryptFile,
  generateEphemeralKeyPair,
  queryCDRPartials,
  uuidToLabel,
  type CDRClient,
} from "@piplabs/cdr-sdk";
import { fromHex, toHex } from "viem";
import type { PublicClient } from "viem";
import { getApiUrl } from "./client.js";
import { downloadCiphertext } from "./download-ciphertext.js";
import { log, timed } from "./logger.js";
import type { SkillCdrListing } from "../arkiv/lib/cdr-listing.js";

const DECRYPT_TIMEOUT_MS = Number(process.env.CDR_DECRYPT_TIMEOUT_MS ?? "300000");
const POLL_LOG_INTERVAL_MS = Number(process.env.CDR_POLL_LOG_INTERVAL_MS ?? "5000");

function summarizePartials(
  uuid: number,
  requesterPubKeyHex: string,
): Promise<string> {
  return queryCDRPartials({
    apiUrl: getApiUrl(),
    uuid,
    requesterPubKeyHex: requesterPubKeyHex.replace(/^0x/i, ""),
  })
    .then((groups) => {
      if (!groups.length) return "no partial buckets yet";
      return groups
        .map(
          (g) =>
            `round=${g.round} subs=${g.submissions.length} need~? met=${g.thresholdMet}`,
        )
        .join(" | ");
    })
    .catch((e: Error) => `Story-API error: ${e.message}`);
}

/**
 * Same as consumer.downloadFile but with per-phase logs and validator poll progress.
 */
export async function downloadFileWithLogs(opts: {
  client: CDRClient;
  publicClient: PublicClient;
  uuid: number;
  accessAuxData: `0x${string}`;
  listing: SkillCdrListing;
  timeoutMs?: number;
}): Promise<{ content: Uint8Array; cid: string; txHash: `0x${string}` }> {
  const timeoutMs = opts.timeoutMs ?? DECRYPT_TIMEOUT_MS;
  const { consumer, observer } = opts.client;

  log.section("CDR decrypt — preflight");
  const threshold = await timed("query operational DKG threshold", () =>
    observer.getOperationalThreshold(),
  );
  log.info(`Operational threshold (validators needed): ${threshold}`);

  const readFee = await observer.getReadFee();
  log.info(`CDR read fee: ${readFee} wei`);

  const vault = await timed(`load vault #${opts.uuid} from chain`, () =>
    observer.getVault(opts.uuid),
  );
  log.info(
    `Vault encrypted payload size: ${vault.encryptedData.length > 2 ? (vault.encryptedData.length - 2) / 2 : 0} bytes (hex)`,
  );

  const globalPubKey = await timed("fetch DKG global public key (Story-API)", () =>
    observer.getGlobalPubKey(),
  );
  log.info(`Global pubkey length: ${globalPubKey.length} bytes`);

  const kp = generateEphemeralKeyPair();
  const recipientPrivKey = kp.privateKey;
  const requesterPubKey = toHex(kp.publicKey);
  log.info(`Ephemeral requester pubkey: ${requesterPubKey.slice(0, 20)}...`);

  log.section("CDR decrypt — on-chain read()");
  const { txHash } = await timed("submit CDR read() transaction", () =>
    consumer.read({
      uuid: opts.uuid,
      accessAuxData: opts.accessAuxData,
      requesterPubKey,
    }),
  );
  log.info(`read() tx hash: ${txHash}`);

  await timed("wait for read() receipt", () =>
    opts.publicClient.waitForTransactionReceipt({ hash: txHash }),
  );

  log.section("CDR decrypt — validator partials (slowest step)");
  log.info(
    `Polling Story-API ${getApiUrl()} every ~3s (progress log every ${POLL_LOG_INTERVAL_MS}ms, timeout ${timeoutMs}ms)`,
  );

  let stopProgress = false;
  const progressTimer = setInterval(() => {
    if (stopProgress) return;
    void summarizePartials(opts.uuid, requesterPubKey).then((summary) => {
      log.info(`[validators] ${summary}`);
    });
  }, POLL_LOG_INTERVAL_MS);

  let partials;
  try {
    partials = await timed("collectPartials from validators", () =>
      consumer.collectPartials({
        uuid: opts.uuid,
        requesterPubKey,
        timeoutMs,
        pollIntervalMs: 3000,
        onInvalidPartial: (event, error) => {
          log.warn(
            `rejected partial from validator ${event.validator}: ${error.message}`,
          );
        },
      }),
    );
  } finally {
    stopProgress = true;
    clearInterval(progressTimer);
  }

  log.ok(`Received ${partials.length} partial decryption(s)`);

  log.section("CDR decrypt — combine key + IPFS + AES");
  const vaultCiphertext = fromHex(
    (await observer.getVault(opts.uuid)).encryptedData,
    "bytes",
  );
  const label = uuidToLabel(opts.uuid);

  const payloadBytes = await timed("TDH2 combine partials → vault payload", () =>
    consumer.decryptDataKey({
      ciphertext: { raw: vaultCiphertext, label },
      partials,
      recipientPrivKey,
      globalPubKey,
      label,
    }),
  );

  const payloadStr = new TextDecoder().decode(payloadBytes);
  const { cid, key: keyHex } = JSON.parse(payloadStr) as { cid: string; key: string };
  log.info(`Vault payload CID: ${cid}`);
  log.info(`Arkiv catalog CID: ${opts.listing.cid}`);
  log.info(`AES key (hex prefix): ${keyHex.slice(0, 16)}...`);

  log.section("IPFS — fetch ciphertext (catalog CID + ops.heliaMultiaddrs)");
  const encryptedFile = await downloadCiphertext(opts.listing, cid);
  log.info(`Downloaded ciphertext: ${encryptedFile.length} bytes`);

  const key = fromHex(keyHex as `0x${string}`, "bytes");
  const content = await timed("AES decrypt file locally", async () =>
    decryptFile({ ciphertext: encryptedFile, key }),
  );
  log.ok(`Plaintext size: ${content.length} bytes`);

  recipientPrivKey.fill(0);

  return { content, cid, txHash };
}
