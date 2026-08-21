import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type { Actor } from "../src/auth/authz.ts";
import {
  attachDriveDocument,
  driveFileIdFromUrl,
  getDocument,
  listDocuments,
  readDocumentContent,
  sanitizeFileName,
  softDeleteDocument,
  uploadPhoto,
} from "../src/domain/documents.ts";
import { createRepair } from "../src/domain/repairs.ts";
import {
  QueuedMondaySyncPort,
  canonicalKeyFor,
  detachEntity,
  findByCanonicalKey,
  getLink,
  linkEntity,
  pendingSyncQueue,
  queuePush,
  upsertBoard,
} from "../src/integrations/monday.ts";
import { createHarness, type Harness } from "./harness.ts";

describe("Google Drive references", () => {
  let harness: Harness;
  let brandon: Actor;

  beforeEach(async () => {
    harness = await createHarness();
    brandon = await harness.actor("brandon@hplacer.com");
  });

  it("stores the file id and view link, never a copy", async () => {
    const id = await attachDriveDocument(harness.db, brandon, {
      documentType: "plat",
      webViewUrl: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing",
      fileName: "Lot 13 plat.pdf",
      target: { lotId: "lot_2601_13", jobId: "job_2601" },
    });
    const document = await getDocument(harness.db, id);
    assert.equal(document?.storage_provider, "google_drive");
    assert.equal(document?.storage_key, "1AbCdEfGhIjKlMnOp");
    assert.equal(document?.external_url, "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing");
    assert.equal(document?.byte_size, null, "nothing is copied into the portal");
  });

  it("pulls the file id out of the shapes people actually paste", () => {
    assert.equal(driveFileIdFromUrl("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view"), "1AbCdEfGhIjKlMnOp");
    assert.equal(driveFileIdFromUrl("https://drive.google.com/folders/1FolderIdaaaaaaaa"), "1FolderIdaaaaaaaa");
    assert.equal(driveFileIdFromUrl("https://drive.google.com/open?id=1QueryIdaaaaaaaaa"), "1QueryIdaaaaaaaaa");
    assert.equal(driveFileIdFromUrl("https://drive.google.com/"), null);
  });

  it("refuses a link that is not Google Drive", async () => {
    await assert.rejects(
      attachDriveDocument(harness.db, brandon, {
        documentType: "plat",
        webViewUrl: "https://drive.evil.example/file/d/1AbCdEfGhIjKlMnOp/view",
        fileName: "x.pdf",
        target: { jobId: "job_2601" },
      }),
      /not a Google Drive link/,
    );
  });

  it("refuses a document with nothing to attach it to", async () => {
    await assert.rejects(
      attachDriveDocument(harness.db, brandon, {
        documentType: "plat",
        webViewUrl: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view",
        fileName: "x.pdf",
        target: {},
      }),
      /Attach the document to/,
    );
  });
});

describe("private photo storage", () => {
  let harness: Harness;
  let wes: Actor;

  beforeEach(async () => {
    harness = await createHarness();
    wes = await harness.actor("wes@hplacer.com");
  });

  const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]).buffer;

  it("writes the object, then marks the row stored", async () => {
    const id = await uploadPhoto(harness.db, harness.store, wes.employeeId, {
      documentType: "photo",
      fileName: "IMG 0042 (1).JPG",
      contentType: "image/jpeg",
      bytes: png(),
      target: { homeId: "hom_a1" },
    });
    const document = await getDocument(harness.db, id);
    assert.equal(document?.upload_status, "stored");
    assert.equal(document?.file_name, "IMG-0042-1-.JPG");
    assert.match(document!.storage_key, /^photos\/\d{4}\/\d{2}\/doc_[a-z0-9]+\/IMG-0042-1-\.JPG$/);
    assert.equal(document?.external_url, null, "R2 objects never get a stored URL");
    assert.equal(harness.store.size, 1);
  });

  it("leaves a failed row rather than metadata pointing at nothing", async () => {
    const brokenStore = {
      async put(): Promise<never> {
        throw new Error("bucket unavailable");
      },
      async get() {
        return null;
      },
      async head() {
        return null;
      },
      async delete() {},
    };
    await assert.rejects(
      uploadPhoto(harness.db, brokenStore, wes.employeeId, {
        documentType: "photo",
        fileName: "x.jpg",
        contentType: "image/jpeg",
        bytes: png(),
        target: { homeId: "hom_a1" },
      }),
      /bucket unavailable/,
    );
    const row = await harness.db
      .prepare("SELECT upload_status FROM documents WHERE home_id = 'hom_a1' AND storage_provider = 'r2'")
      .first<{ upload_status: string }>();
    assert.equal(row?.upload_status, "failed");
  });

  it("refuses an unsupported file type and an oversized file", async () => {
    await assert.rejects(
      uploadPhoto(harness.db, harness.store, wes.employeeId, {
        documentType: "photo",
        fileName: "x.svg",
        contentType: "image/svg+xml",
        bytes: png(),
        target: { homeId: "hom_a1" },
      }),
      /not an accepted file type/,
    );
    await assert.rejects(
      uploadPhoto(harness.db, harness.store, wes.employeeId, {
        documentType: "photo",
        fileName: "big.jpg",
        contentType: "image/jpeg",
        bytes: new ArrayBuffer(16 * 1024 * 1024),
        target: { homeId: "hom_a1" },
      }),
      /15 MB or smaller/,
    );
  });

  it("strips path traversal out of a filename", () => {
    assert.equal(sanitizeFileName("../../etc/passwd"), "passwd");
    assert.equal(sanitizeFileName("C:\\Users\\me\\photo.jpg"), "photo.jpg");
    assert.equal(sanitizeFileName(".hidden"), "hidden");
    assert.equal(sanitizeFileName("……"), "upload");
  });

  it("scopes a ticket photo to the crew that can see the ticket", async () => {
    const ticketId = await createRepair(harness.db, wes, { title: "Private", description: "x", assetId: "ast_ex1" });
    const documentId = await uploadPhoto(harness.db, harness.store, wes.employeeId, {
      documentType: "photo",
      fileName: "damage.jpg",
      contentType: "image/jpeg",
      bytes: png(),
      target: { repairTicketId: ticketId },
    });

    const nina = await harness.actor("nina@hplacer.com");
    await assert.rejects(readDocumentContent(harness.db, harness.store, nina, documentId), /do not have access/);

    const brett = await harness.actor("brett@hplacer.com");
    const supervisorRead = await readDocumentContent(harness.db, harness.store, brett, documentId);
    assert.equal(supervisorRead.bytes.byteLength, 8);

    const ownerRead = await readDocumentContent(harness.db, harness.store, wes, documentId);
    assert.equal(ownerRead.bytes.byteLength, 8);
  });

  it("hides a soft-deleted document and lets only the uploader or a supervisor remove it", async () => {
    const id = await uploadPhoto(harness.db, harness.store, wes.employeeId, {
      documentType: "photo",
      fileName: "x.jpg",
      contentType: "image/jpeg",
      bytes: png(),
      target: { homeId: "hom_a1" },
    });
    const nina = await harness.actor("nina@hplacer.com");
    await assert.rejects(softDeleteDocument(harness.db, nina, id), /Only the person who uploaded it/);

    await softDeleteDocument(harness.db, wes, id);
    const listed = await listDocuments(harness.db, { homeId: "hom_a1" });
    assert.ok(!listed.some((document) => document.id === id));
    await assert.rejects(readDocumentContent(harness.db, harness.store, wes, id), /not found/);
  });
});

describe("Monday link registry", () => {
  let harness: Harness;
  let port: QueuedMondaySyncPort;

  before(async () => {
    harness = await createHarness();
    port = new QueuedMondaySyncPort(harness.db);
  });
  after(() => harness.close());

  it("derives the canonical key from the record, not from a portal id", async () => {
    assert.deepEqual(await canonicalKeyFor(harness.db, "home", "hom_a2"), { key: "CLT2026TN903318X", kind: "serial_number" });
    // Road equipment keys on the VIN; yard equipment falls back to the serial.
    assert.deepEqual(await canonicalKeyFor(harness.db, "asset", "ast_pk1"), { key: "1FT8W2BT4PEC55011", kind: "vin" });
    assert.deepEqual(await canonicalKeyFor(harness.db, "asset", "ast_ex1"), { key: "DR135G21008841", kind: "serial_number" });
    assert.deepEqual(await canonicalKeyFor(harness.db, "job", "job_2604"), { key: "HP2604", kind: "job_number" });
  });

  it("records a link and queues it instead of calling Monday", async () => {
    const id = await linkEntity(harness.db, port, {
      entityType: "home",
      entityId: "hom_a2",
      boardKey: "homes",
      mondayItemId: "2000000099",
    });
    assert.ok(id);

    const link = await getLink(harness.db, "home", "hom_a2");
    assert.equal(link?.canonical_key, "CLT2026TN903318X");
    assert.equal(link?.sync_state, "linked");

    const mirrored = await harness.db.prepare("SELECT monday_item_id FROM homes WHERE id = 'hom_a2'").first<{ monday_item_id: string }>();
    assert.equal(mirrored?.monday_item_id, "2000000099");

    const queue = await pendingSyncQueue(harness.db);
    const entry = queue.find((row) => row.entity_id === "hom_a2");
    assert.equal(entry?.operation, "link");
    assert.equal(entry?.status, "queued");
    assert.equal(entry?.canonical_key, "CLT2026TN903318X");
  });

  it("refuses to key a board on the wrong kind of identifier", async () => {
    await assert.rejects(
      linkEntity(harness.db, port, { entityType: "asset", entityId: "ast_ex1", boardKey: "equipment", mondayItemId: "2000000100" }),
      /keys on vin, but this record's key is a serial number/,
    );
  });

  it("refuses to claim one Monday item twice", async () => {
    await assert.rejects(
      linkEntity(harness.db, port, { entityType: "home", entityId: "hom_a3", boardKey: "homes", mondayItemId: "2000000099" }),
      /already linked to another home/,
    );
  });

  it("refuses a non-numeric item id and an unconfigured board", async () => {
    await assert.rejects(
      linkEntity(harness.db, port, { entityType: "home", entityId: "hom_a3", boardKey: "homes", mondayItemId: "abc" }),
      /item id is numeric/,
    );
    await assert.rejects(
      linkEntity(harness.db, port, { entityType: "repair_ticket", entityId: "rep_1", boardKey: "repairs", mondayItemId: "5" }),
      /has not been configured yet/,
    );
  });

  it("validates the board configuration itself", async () => {
    await assert.rejects(
      upsertBoard(harness.db, { boardKey: "homes", mondayBoardId: "1000000001", name: "Homes", canonicalKeyKind: "vin" }),
      /must key on serial number/,
    );
    await upsertBoard(harness.db, { boardKey: "repairs", mondayBoardId: "1000000004", name: "Repairs", canonicalKeyKind: "ticket_number" });
    const link = await linkEntity(harness.db, port, {
      entityType: "repair_ticket",
      entityId: "rep_1",
      boardKey: "repairs",
      mondayItemId: "3000000001",
    });
    assert.ok(link);
  });

  it("finds every record that shares a canonical key", async () => {
    const matches = await findByCanonicalKey(harness.db, "clt-2026-tn 903318x");
    assert.equal(matches.length, 1);
    assert.equal(matches[0].entity_type, "home");
  });

  it("queues a push only for a linked record", async () => {
    const queued = await queuePush(harness.db, port, "home", "hom_a2", { status: "Setup complete" });
    assert.ok(queued);
    const unlinked = await queuePush(harness.db, port, "home", "hom_a3", { status: "x" });
    assert.equal(unlinked, null);
  });

  it("detaches without deleting the history", async () => {
    await detachEntity(harness.db, port, "home", "hom_a2");
    const link = await getLink(harness.db, "home", "hom_a2");
    assert.equal(link?.sync_state, "detached");
    assert.equal(link?.monday_item_id, "2000000099", "the item id is kept for reference");
    const mirrored = await harness.db.prepare("SELECT monday_item_id FROM homes WHERE id = 'hom_a2'").first<{ monday_item_id: string | null }>();
    assert.equal(mirrored?.monday_item_id, null);
    assert.equal(await queuePush(harness.db, port, "home", "hom_a2", { status: "x" }), null);
  });
});
