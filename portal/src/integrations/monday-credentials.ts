/**
 * Where the Monday.com token comes from.
 *
 * The token is a **full-access** Monday API token. It is stored in the operator's
 * macOS Keychain under service `homeplacer-monday-api`, account
 * `homeplacer-portal`, and it is read at runtime, once, by the operator running
 * an import. It is never committed, never written to a file, never put in an
 * environment variable that shows up in `ps`, and never printed.
 *
 * Three habits keep it that way:
 *
 *  - the value is returned as an opaque `MondayToken` whose `toString` and
 *    `toJSON` both render `***`, so an accidental interpolation or
 *    `JSON.stringify` cannot leak it;
 *  - `redact()` is applied to every error message and every subprocess stream
 *    before it reaches a log; and
 *  - nothing in `portal/src` outside this file ever holds the raw string —
 *    `MondayClient` asks for an Authorization header, not for a token.
 *
 * Storing it (done once, by a person, not by this code):
 *
 *   security add-generic-password -U -s homeplacer-monday-api \
 *     -a homeplacer-portal -w
 *
 * `-w` with no value prompts, so the token never appears in shell history.
 */

const KEYCHAIN_SERVICE = "homeplacer-monday-api";
const KEYCHAIN_ACCOUNT = "homeplacer-portal";

/**
 * An opaque handle around the secret. Read it exactly once, at the point of use,
 * with `authorizationHeader()`.
 */
export class MondayToken {
  readonly #value: string;

  constructor(value: string) {
    const trimmed = value.trim();
    if (!trimmed) throw new Error("Monday token is empty");
    this.#value = trimmed;
  }

  authorizationHeader(): string {
    return this.#value;
  }

  /** Redacts this token wherever it appears in `text`. */
  redact(text: string): string {
    return text.split(this.#value).join("***");
  }

  toString(): string {
    return "***";
  }

  toJSON(): string {
    return "***";
  }

  get [Symbol.toStringTag](): string {
    return "MondayToken";
  }
}

export interface TokenSource {
  describe(): string;
  read(): Promise<MondayToken>;
}

/**
 * Generic redaction for anything that looks like a Monday token (a long JWT) or
 * a bearer header, used on output we did not generate.
 */
export function redact(text: string): string {
  return text
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "***")
    .replace(/(authorization\s*[:=]\s*)\S+/gi, "$1***")
    .replace(/(-w\s+)\S+/g, "$1***");
}

/**
 * Reads the token from the macOS Keychain via `security`.
 *
 * Node-only, and used only by the operator tooling in `portal/ops`. The Worker
 * never imports this module — the portal has no outbound Monday integration at
 * runtime, by design.
 */
export function keychainTokenSource(
  options: { service?: string; account?: string } = {},
): TokenSource {
  const service = options.service ?? KEYCHAIN_SERVICE;
  const account = options.account ?? KEYCHAIN_ACCOUNT;

  return {
    describe() {
      return `macOS Keychain (service ${service}, account ${account})`;
    },
    async read() {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const run = promisify(execFile);

      let stdout: string;
      try {
        // -w prints only the password, on stdout. It is consumed here and never
        // echoed, logged, or passed on as a string.
        ({ stdout } = await run("security", ["find-generic-password", "-s", service, "-a", account, "-w"], {
          maxBuffer: 1024 * 64,
        }));
      } catch (error) {
        const detail = redact(error instanceof Error ? error.message : String(error));
        throw new Error(
          `Could not read the Monday token from the Keychain (service ${service}, account ${account}).\n` +
            `Store it once with:\n` +
            `  security add-generic-password -U -s ${service} -a ${account} -w\n` +
            `Underlying error: ${detail}`,
        );
      }
      return new MondayToken(stdout);
    },
  };
}

/**
 * For tests and for a dry run against a saved fixture. Deliberately not wired to
 * an environment variable in production tooling: the Keychain is the store of
 * record, and an env var would put the secret in the process table.
 */
export function staticTokenSource(value: string, label = "in-memory (test)"): TokenSource {
  return {
    describe: () => label,
    read: async () => new MondayToken(value),
  };
}

/**
 * Wraps a Cloudflare Worker secret. This is intentionally separate from the
 * operator Keychain path: the secret binding is available only inside the
 * deployed Worker and its opaque wrapper retains the same logging safeguards.
 */
export function workerSecretTokenSource(value: string): TokenSource {
  const token = new MondayToken(value);
  return {
    describe: () => "Cloudflare Worker secret",
    read: async () => token,
  };
}
