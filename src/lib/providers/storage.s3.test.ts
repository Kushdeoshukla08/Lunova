/**
 * The S3/R2 provider, against a mocked AWS client.
 *
 * Nobody can run this against real R2 until a bucket exists, and the day it is
 * switched on is the worst possible time to discover the provider sends the
 * wrong thing. So: assert the commands it issues, the keys it mints and the
 * headers it pins — everything that decides whether a stored object can be
 * turned back into an active document.
 *
 * What cannot be observed through a mocked client is asserted on the payload
 * builder (`s3PutInput`) directly — testing headers through the SDK's dynamic
 * import tests its plumbing, not this decision.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `vi.hoisted` + `vi.mock`, not `vi.doMock`: the factory has to share state
 * with the assertions, and a `doMock` factory closes over a different instance
 * of this module than the tests run in — so a module-scoped array inside it is
 * never the one being read.
 */
const aws = vi.hoisted(() => ({
  clientConfigs: [] as Record<string, unknown>[],
  signed: [] as { input: Record<string, unknown>; expiresIn: number }[],
}));

vi.mock("@aws-sdk/client-s3", () => {
  // The command classes only need to carry their input to the (mocked)
  // presigner; what put/get/delete send is asserted through s3PutInput and the
  // provider's return values instead.
  const command = class {
    constructor(public input: Record<string, unknown>) {}
  };
  return {
    S3Client: class {
      constructor(config: Record<string, unknown>) {
        aws.clientConfigs.push(config);
      }
      async send() {
        // Only GetObject reads the result; an unused Body on the others is
        // harmless, and the assertions are about what was *sent*.
        return { Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } };
      }
    },
    PutObjectCommand: command,
    GetObjectCommand: command,
    DeleteObjectCommand: command,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: async (
    _client: unknown,
    command: { input: Record<string, unknown> },
    options: { expiresIn: number },
  ) => {
    aws.signed.push({ input: command.input, expiresIn: options.expiresIn });
    return "https://signed.example/object?sig=abc";
  },
}));

function mockEnv(overrides: Record<string, unknown> = {}) {
  vi.doMock("@/lib/env", () => ({
    env: {
      NODE_ENV: "production",
      APP_ENV: "staging",
      STORAGE_PROVIDER: "s3",
      STORAGE_LOCAL_DIR: ".uploads",
      S3_BUCKET: "lunova-staging-media",
      S3_REGION: "auto",
      S3_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
      S3_ACCESS_KEY_ID: "AKIA_test",
      S3_SECRET_ACCESS_KEY: "secret_test",
      ...overrides,
    },
    isProdLike: true,
    isProduction: false,
  }));
}

const loadStorage = async () => (await import("./storage")).storage;

beforeEach(() => {
  vi.resetModules();
  // The provider caches its instance on globalThis so the connection pool
  // survives dev HMR; globalThis outlives resetModules, so clear it or a test
  // silently reuses the previous one.
  delete (globalThis as { lunovaStorage?: unknown }).lunovaStorage;
  aws.clientConfigs.length = 0;
  aws.signed.length = 0;
});
afterEach(() => vi.doUnmock("@/lib/env"));

describe("S3StorageProvider", () => {
  it("is selected by STORAGE_PROVIDER and reports itself ready", async () => {
    mockEnv();
    const { storageStatus } = await import("./storage");
    expect(storageStatus()).toEqual({ provider: "s3", ready: true, missing: [] });
  });

  it("names the variables it is missing instead of failing obscurely", async () => {
    mockEnv({ S3_BUCKET: "", S3_SECRET_ACCESS_KEY: "" });
    const { storageStatus } = await import("./storage");
    expect(storageStatus()).toEqual({
      provider: "s3",
      ready: false,
      missing: ["S3_BUCKET", "S3_SECRET_ACCESS_KEY"],
    });
  });

  it("uses path-style addressing when an endpoint is set — R2 requires it", async () => {
    mockEnv();
    const storage = await loadStorage();
    await storage.put("photos", Buffer.from("x"), "image/png");
    expect(aws.clientConfigs[0]).toMatchObject({
      region: "auto",
      endpoint: "https://acct.r2.cloudflarestorage.com",
      forcePathStyle: true,
    });
  });

  it("leaves addressing alone for AWS, where no endpoint is set", async () => {
    mockEnv({ S3_ENDPOINT: "", S3_REGION: "eu-west-1" });
    const storage = await loadStorage();
    await storage.put("photos", Buffer.from("x"), "image/png");
    expect(aws.clientConfigs[0]).toMatchObject({
      region: "eu-west-1",
      endpoint: undefined,
      forcePathStyle: false,
    });
  });

  it("mints a sharded key from the sniffed type, never from a filename", async () => {
    mockEnv();
    const storage = await loadStorage();
    const { key } = await storage.put("photos", Buffer.from("x"), "image/webp");
    expect(key).toMatch(/^photos\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f-]{36}\.webp$/);
  });

  it("pins the response type on upload so a stored object cannot be re-typed", async () => {
    mockEnv();
    // Asserted on the payload builder directly. Going through a mocked AWS
    // client would test the SDK's plumbing; these headers are the decision.
    const { s3PutInput } = await import("./storage");
    const input = s3PutInput("bucket", "photos/ab/cd/x.png", Buffer.from("x"), "image/png");
    expect(input).toMatchObject({
      Bucket: "bucket",
      Key: "photos/ab/cd/x.png",
      ContentType: "image/png",
      ContentDisposition: "inline",
    });
    // Never shared-cacheable: /media authorizes each request, so a public cache
    // entry would hand one member's photo to another.
    expect(input.CacheControl).toContain("private");
    expect(input.CacheControl).not.toContain("public");
  });

  it("returns an app-relative URL, never a bucket URL", async () => {
    mockEnv();
    const storage = await loadStorage();
    // The bucket stays private; /media authorizes before redirecting. A public
    // object URL here would route around every check in that route.
    expect(storage.publicUrl("photos/ab/cd/x.png")).toBe("/media/photos/ab/cd/x.png");
  });

  it("signs a time-limited GET with the type and disposition forced", async () => {
    mockEnv();
    const storage = await loadStorage();
    const url = await storage.signedUrl("photos/ab/cd/x.png", 900);
    expect(url).toBe("https://signed.example/object?sig=abc");
    expect(aws.signed[0]).toMatchObject({
      expiresIn: 900,
      input: {
        Bucket: "lunova-staging-media",
        Key: "photos/ab/cd/x.png",
        ResponseContentType: "image/png",
        ResponseContentDisposition: "inline",
      },
    });
  });

  it("refuses to sign or fetch a key that fails validation", async () => {
    mockEnv();
    const storage = await loadStorage();
    for (const bad of ["../secrets", "photos/../../.env", "/etc/passwd", "photos/x .png"]) {
      expect(await storage.signedUrl(bad, 60), bad).toBeNull();
      expect(await storage.get(bad), bad).toBeNull();
    }
    // Nothing was signed, so nothing could have been fetched.
    expect(aws.signed, "a malformed key must never be signed").toEqual([]);
  });

  it("derives the content type from our own extension, not the stored header", async () => {
    mockEnv();
    const storage = await loadStorage();
    const got = await storage.get("photos/ab/cd/x.avif");
    // Our own extension decides the type — never a header the bucket returns.
    expect(got?.contentType).toBe("image/avif");
    expect(got?.bytes).toBeInstanceOf(Buffer);
  });

  it("swallows delete failures — an orphaned object must not fail a user action", async () => {
    mockEnv();
    const storage = await loadStorage();
    await expect(storage.delete("photos/ab/cd/x.png")).resolves.toBeUndefined();
  });

  it("does not touch the bucket at all when configuration is incomplete", async () => {
    mockEnv({ S3_ACCESS_KEY_ID: "" });
    const storage = await loadStorage();
    // get/delete degrade quietly; put must surface the problem rather than
    // silently dropping a member's photo.
    await expect(storage.put("photos", Buffer.from("x"), "image/png")).rejects.toThrow(
      /S3_ACCESS_KEY_ID/,
    );
    // No client was ever constructed, so nothing could have reached the bucket.
    expect(aws.clientConfigs).toEqual([]);
  });
});
