#!/usr/bin/env node
/**
 * Terminal QR for device registration (matches stellar-mobile-agents register-device.sh).
 * Uses qrcode-terminal with error level L and compact blocks for readable output.
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);

const registrationUrl = process.argv[2] || process.env.REGISTER_URL || process.env.QR_URL;
if (!registrationUrl) {
  console.error('Usage: node print-registration-qr.mjs <registration-url>');
  process.exit(1);
}

let qrUrl = registrationUrl;
const shortenDisabled = process.env.REGISTER_QR_SHORTEN === '0';

/** Shorten dense URLs so the terminal QR stays compact and scannable. */
if (!shortenDisabled && registrationUrl.length > 180) {
  try {
    const encoded = encodeURIComponent(registrationUrl);
    const tiny = execSync(
      `curl -fsSL "https://tinyurl.com/api-create.php?url=${encoded}"`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (tiny.startsWith('http')) {
      qrUrl = tiny;
    }
  } catch {
    /* use full URL */
  }
}

let qrcode;
try {
  qrcode = require('qrcode-terminal');
} catch {
  console.error(
    'qrcode-terminal is not installed. Run: npm install --prefix .. (from skill-capture root)',
  );
  process.exit(1);
}

qrcode.setErrorLevel('L');
qrcode.generate(qrUrl, { small: true }, (qr) => {
  console.log(qr);
});

if (qrUrl !== registrationUrl) {
  console.log('\n(QR encodes a short link that redirects to the full registration URL below.)\n');
}

console.log('Or open this URL in your browser:');
console.log(registrationUrl);
