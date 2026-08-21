/**
 * In-memory `ObjectStore` used by `npm run portal:dev` and the tests so the
 * photo-upload path is exercisable without an R2 bucket. Never used in the
 * Worker: production binds the real private bucket.
 */
import type { ObjectPutOptions, ObjectStore, StoredObject } from "./types.ts";

export class MemoryObjectStore implements ObjectStore {
  readonly #objects = new Map<string, { bytes: Uint8Array; contentType?: string; custom?: Record<string, string> }>();

  async put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | ReadableStream | null,
    options?: ObjectPutOptions,
  ): Promise<StoredObject> {
    let bytes: Uint8Array;
    if (value === null) bytes = new Uint8Array();
    else if (typeof value === "string") bytes = new TextEncoder().encode(value);
    else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
    else if (ArrayBuffer.isView(value)) bytes = new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
    else throw new TypeError("Streaming uploads are not supported by the in-memory store");

    this.#objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType, custom: options?.customMetadata });
    return this.#describe(key) as StoredObject;
  }

  async get(key: string): Promise<StoredObject | null> {
    const stored = this.#objects.get(key);
    if (!stored) return null;
    const described = this.#describe(key) as StoredObject;
    const bytes = stored.bytes;
    described.arrayBuffer = async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return described;
  }

  async head(key: string): Promise<StoredObject | null> {
    return this.#describe(key);
  }

  async delete(key: string): Promise<void> {
    this.#objects.delete(key);
  }

  get size(): number {
    return this.#objects.size;
  }

  #describe(key: string): StoredObject | null {
    const stored = this.#objects.get(key);
    if (!stored) return null;
    return {
      key,
      size: stored.bytes.byteLength,
      etag: `w/${stored.bytes.byteLength.toString(16)}`,
      httpMetadata: { contentType: stored.contentType },
      customMetadata: stored.custom,
    };
  }
}
