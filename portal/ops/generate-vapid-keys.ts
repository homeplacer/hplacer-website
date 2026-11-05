/**
 * Generates a VAPID key pair for portal Web Push.
 *
 *   node portal/ops/generate-vapid-keys.ts <private-key-file>
 *
 * Prints only the PUBLIC key (safe for a plain var). The private key is written
 * to the given file with owner-only permissions so it never lands in terminal
 * scrollback; pipe it into `wrangler secret put` and then delete the file.
 */
import { existsSync, writeFileSync } from "node:fs";
import { base64UrlEncode } from "../src/integrations/web-push.ts";

const target = process.argv[2];
if (!target) {
  console.error("usage: node portal/ops/generate-vapid-keys.ts <private-key-file>");
  process.exit(2);
}
if (existsSync(target)) {
  console.error("refusing to overwrite an existing file");
  process.exit(2);
}

const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
const publicKey = base64UrlEncode(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
writeFileSync(target, jwk.d!, { mode: 0o600, flag: "wx" });
console.log(`WEB_PUSH_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`private key written to ${target} (mode 600)`);
