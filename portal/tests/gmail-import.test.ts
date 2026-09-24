import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runConfiguredGmailImport } from "../src/integrations/gmail-import.ts";
import { createHarness } from "./harness.ts";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

describe("Gmail parts import", () => {
  it("is disabled unless explicitly enabled and fully configured", async () => {
    const harness = await createHarness();
    try {
      const result = await runConfiguredGmailImport(harness.env, { fetcher: async () => { throw new Error("should not fetch"); } });
      assert.equal(result.enabled, false);
    } finally { harness.close(); }
  });

  it("fails closed if the OAuth profile or granted Gmail scope is not exact", async () => {
    const harness = await createHarness();
    try {
      Object.assign(harness.env, {
        GMAIL_INGEST_ENABLED: "true",
        GMAIL_CLIENT_ID: "client-id",
        GMAIL_CLIENT_SECRET: "client-secret",
        GMAIL_REFRESH_TOKEN: "refresh-token",
        GMAIL_ALLOWED_MAILBOX: "brandon@hplacer.com",
      });
      let mode: "scope" | "mailbox" = "scope";
      const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
        const url = String(input);
        if (url === "https://oauth2.googleapis.com/token") return json({
          access_token: "temporary-access-token",
          token_type: "Bearer",
          scope: mode === "scope"
            ? "https://mail.google.com/"
            : "https://www.googleapis.com/auth/gmail.readonly",
        });
        if (url.endsWith("users/me/profile")) return json({ emailAddress: mode === "mailbox" ? "someone-else@example.com" : "brandon@hplacer.com" });
        throw new Error("message API must not be called before exact profile/scope checks pass");
      };
      await assert.rejects(runConfiguredGmailImport(harness.env, { fetcher }), /token_scope_invalid/);
      mode = "mailbox";
      await assert.rejects(runConfiguredGmailImport(harness.env, { fetcher }), /mailbox_mismatch/);
    } finally { harness.close(); }
  });

  it("verifies the mailbox, stages allowed attachments privately, avoids body storage, and deduplicates", async () => {
    const harness = await createHarness();
    try {
      Object.assign(harness.env, {
        GMAIL_INGEST_ENABLED: "true",
        GMAIL_CLIENT_ID: "client-id",
        GMAIL_CLIENT_SECRET: "client-secret",
        GMAIL_REFRESH_TOKEN: "refresh-token",
        GMAIL_ALLOWED_MAILBOX: "brandon@hplacer.com",
      });
      const pdf = Buffer.from("%PDF fixture").toString("base64url");
      const now = new Date("2026-09-23T15:00:00Z");
      const calls: string[] = [];
      const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (url === "https://oauth2.googleapis.com/token") return json({
          access_token: "temporary-access-token",
          token_type: "Bearer",
          scope: "https://www.googleapis.com/auth/gmail.readonly",
        });
        if (url.endsWith("users/me/profile")) return json({ emailAddress: "Brandon@HPlacer.com" });
        if (url.includes("users/me/messages?") && url.includes("messages?")) return json({ messages: [{ id: "gmail-message-1", threadId: "thread-1" }] });
        if (url.endsWith("users/me/messages/gmail-message-1?format=full")) return json({
          id: "gmail-message-1",
          threadId: "thread-1",
          internalDate: String(now.getTime() - 60_000),
          snippet: "Your order shipped; tracking is listed below.",
          payload: {
            mimeType: "multipart/mixed",
            headers: [
              { name: "From", value: "Parts Vendor <shipping@example-parts.com>" },
              { name: "Subject", value: "Order confirmation # PO-48392 shipped" },
            ],
            parts: [
              { mimeType: "text/plain", body: { data: Buffer.from("UPS tracking number 1Z999AA10123456784").toString("base64url"), size: 40 } },
              { filename: "invoice.pdf", mimeType: "application/pdf", body: { data: pdf, size: Buffer.from("%PDF fixture").length } },
              { filename: "unsafe.html", mimeType: "text/html", body: { data: Buffer.from("<script>").toString("base64url"), size: 8 } },
            ],
          },
        });
        return new Response("unexpected request", { status: 404 });
      };

      const first = await runConfiguredGmailImport(harness.env, { fetcher, now });
      assert.deepEqual(first, { enabled: true, found: 1, staged: 1, failed: 0, skipped: 0 });
      const event = await harness.db.prepare("SELECT * FROM vendor_email_events WHERE gmail_message_id = ?").bind("gmail-message-1").first<Record<string, unknown>>();
      assert.equal(event?.status, "needs_review");
      assert.equal(event?.vendor_order_number, "PO-48392");
      assert.equal(event?.carrier_name, "UPS");
      assert.equal(event?.tracking_url, "https://www.ups.com/track?tracknum=1Z999AA10123456784");
      assert.equal(Object.keys(event ?? {}).some((key) => key.toLowerCase().includes("body")), false);
      const attachments = await harness.db.prepare("SELECT * FROM vendor_email_attachments WHERE event_id = ?").bind(event?.id).all<Record<string, unknown>>();
      assert.equal(attachments.results.length, 1, "unsafe HTML is not staged");
      assert.ok(await harness.store.get(String(attachments.results[0]?.storage_key)));

      const second = await runConfiguredGmailImport(harness.env, { fetcher, now: new Date(now.getTime() + 60_000) });
      assert.equal(second.skipped, 1);
      assert.equal(await harness.db.prepare("SELECT count(*) AS n FROM vendor_email_events").first<{ n: number }>().then((row) => row?.n), 1);
      assert.ok(calls.every((call) => !/DELETE|POST https:\/\/gmail\.googleapis\.com/i.test(call)), "Gmail API use is read-only");
    } finally { harness.close(); }
  });

  it("persists pagination when one scheduled run reaches its page budget", async () => {
    const harness = await createHarness();
    try {
      Object.assign(harness.env, {
        GMAIL_INGEST_ENABLED: "true",
        GMAIL_CLIENT_ID: "client-id",
        GMAIL_CLIENT_SECRET: "client-secret",
        GMAIL_REFRESH_TOKEN: "refresh-token",
        GMAIL_ALLOWED_MAILBOX: "brandon@hplacer.com",
      });
      let listCalls = 0;
      const queries: string[] = [];
      const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
        const url = String(input);
        if (url === "https://oauth2.googleapis.com/token") return json({
          access_token: "temporary-access-token", token_type: "Bearer", scope: "https://www.googleapis.com/auth/gmail.readonly",
        });
        if (url.endsWith("users/me/profile")) return json({ emailAddress: "brandon@hplacer.com" });
        if (url.includes("users/me/messages?")) {
          queries.push(new URL(url).searchParams.get("q")!);
          if (new URL(url).searchParams.get("pageToken") === "page-11") return json({ messages: [] });
          listCalls += 1;
          return json(listCalls <= 10 ? { nextPageToken: `page-${listCalls + 1}` } : { messages: [] });
        }
        throw new Error(`unexpected Gmail call ${url}`);
      };
      const now = new Date("2026-09-23T16:00:00Z");
      const first = await runConfiguredGmailImport(harness.env, { fetcher, now });
      assert.equal(first.enabled, true);
      assert.equal(await harness.db.prepare("SELECT state_value FROM portal_integration_state WHERE state_key = 'gmail_last_poll_at'").first(), null);
      assert.equal((await harness.db.prepare("SELECT state_value FROM portal_integration_state WHERE state_key = 'gmail_page_token'").first<{ state_value: string }>())?.state_value, "page-11");

      listCalls = 0;
      const second = await runConfiguredGmailImport(harness.env, { fetcher, now: new Date(now.getTime() + 15 * 60 * 1000) });
      assert.equal(second.enabled, true);
      assert.equal(await harness.db.prepare("SELECT state_value FROM portal_integration_state WHERE state_key = 'gmail_page_token'").first(), null);
      assert.equal((await harness.db.prepare("SELECT state_value FROM portal_integration_state WHERE state_key = 'gmail_last_poll_at'").first<{ state_value: string }>())?.state_value, now.toISOString());
      assert.equal(new Set(queries).size, 1, "resumed pages must use the original query window");
    } finally { harness.close(); }
  });
  it("serializes overlapping polls and releases its lease after failure", async () => {
    const harness = await createHarness();
    try {
      Object.assign(harness.env, { GMAIL_INGEST_ENABLED: "true", GMAIL_CLIENT_ID: "id", GMAIL_CLIENT_SECRET: "secret", GMAIL_REFRESH_TOKEN: "token", GMAIL_ALLOWED_MAILBOX: "brandon@hplacer.com" });
      let release!: () => void;
      let entered!: () => void;
      const started = new Promise<void>((resolve) => { entered = resolve; });
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const first = runConfiguredGmailImport(harness.env, { fetcher: async () => { entered(); await gate; throw new Error("failure"); } });
      await started;
      const second = await runConfiguredGmailImport(harness.env, { fetcher: async () => { throw new Error("overlapping poll fetched"); } });
      assert.equal(second.found, 0);
      release();
      await assert.rejects(first, /token_endpoint_unavailable/);
      assert.equal(await harness.db.prepare("SELECT * FROM portal_integration_state WHERE state_key='gmail_poll_lease'").first(), null);
      assert.equal((await harness.db.prepare("SELECT state_value FROM portal_integration_state WHERE state_key='gmail_last_error'").first<{state_value: string}>())?.state_value, "token_endpoint_unavailable");
    } finally { harness.close(); }
  });

});
