/**
 * Shared npm 2FA OTP for local publish scripts.
 * Reads `.env.placeholder.local` (repo root, gitignored) — same contract as publish-placeholder.mjs.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
);
const ENV_PATH = path.join(REPO_ROOT, ".env.placeholder.local");

/** @returns {Record<string, string>} */
export function loadLocalEnv(filePath = ENV_PATH) {
    /** @type {Record<string, string>} */
    const out = {};
    try {
        const text = fs.readFileSync(filePath, "utf8");
        for (const raw of text.split(/\r?\n/)) {
            const line = raw.trim();
            if (!line || line.startsWith("#")) continue;
            const m = line.match(
                /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
            );
            if (!m) continue;
            let v = m[2].trim();
            if (
                (v.startsWith('"') && v.endsWith('"')) ||
                (v.startsWith("'") && v.endsWith("'"))
            ) {
                v = v.slice(1, -1);
            }
            out[m[1]] = v;
        }
    } catch {
        /* optional */
    }
    return out;
}

const localEnv = loadLocalEnv();

const otpFlag =
    process.argv.find((a) => a.startsWith("--otp="))?.slice("--otp=".length) ??
    process.env.NPM_OTP ??
    localEnv.NPM_OTP ??
    localEnv.OTP;

const totpSecretRaw =
    process.argv
        .find((a) => a.startsWith("--totp-secret="))
        ?.slice("--totp-secret=".length) ??
    process.env.NPM_TOTP_SECRET ??
    localEnv.NPM_TOTP_SECRET ??
    localEnv.TOTP_SECRET ??
    (otpFlag && !/^\d{6}$/.test(otpFlag.trim()) ? otpFlag : undefined);

const otpStatic =
    otpFlag && /^\d{6}$/.test(otpFlag.trim()) ? otpFlag.trim() : undefined;

/** @param {string} secret */
function decodeBase32(secret) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const cleaned = secret.replace(/[\s=-]/g, "").toUpperCase();
    let bits = "";
    for (const ch of cleaned) {
        const v = alphabet.indexOf(ch);
        if (v < 0) throw new Error("invalid base32 in TOTP secret");
        bits += v.toString(2).padStart(5, "0");
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
    }
    if (!bytes.length) throw new Error("TOTP secret decoded empty");
    return Buffer.from(bytes);
}

/** RFC 6238 TOTP (SHA-1, 30s, 6 digits). */
function totpCode(secret, atMs = Date.now()) {
    const key = decodeBase32(secret);
    const counter = Math.floor(atMs / 1000 / 30);
    const buf = Buffer.alloc(8);
    buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    buf.writeUInt32BE(counter & 0xffffffff, 4);
    const hmac = crypto.createHmac("sha1", key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    return String(code % 1_000_000).padStart(6, "0");
}

/** @returns {string | undefined} */
export function currentOtp() {
    if (totpSecretRaw) return totpCode(totpSecretRaw);
    return otpStatic;
}

export function otpAuthMode() {
    if (totpSecretRaw) return "totp";
    if (otpStatic) return "otp6";
    return "none";
}
