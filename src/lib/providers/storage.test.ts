import { describe, expect, it } from "vitest";
import { isSafeKey } from "./storage";

/**
 * Object keys are always minted server-side, but they come back from the
 * database and from `/media/[...key]` URL segments, so the guard is what stands
 * between a crafted path and the filesystem.
 */
describe("isSafeKey", () => {
  it("accepts the keys the provider actually mints", () => {
    expect(isSafeKey("photos/ab/cd/0f8fad5b-d9cb-469f-a165-70867728950e.jpg")).toBe(true);
    expect(isSafeKey("photos/00/11/aaaa.webp")).toBe(true);
    expect(isSafeKey("verification/ab/cd/x.png")).toBe(true);
  });

  it("rejects traversal in every encoding the path layer might hand us", () => {
    const traversals = [
      "../etc/passwd",
      "photos/../../etc/passwd",
      "photos/ab/../../../.env",
      "photos/..",
      "..",
      "./photos/x.jpg",
      "photos/./x.jpg",
      "photos/ab/..%2f..%2f.env",
    ];
    for (const key of traversals) {
      expect(isSafeKey(key), key).toBe(false);
    }
  });

  it("rejects absolute, UNC and drive-letter paths", () => {
    for (const key of [
      "/etc/passwd",
      "//evil.example/share/x",
      "\\\\evil.example\\share\\x",
      "C:/Windows/System32/config/SAM",
      "C:\\Windows\\win.ini",
      "photos\\ab\\cd\\x.jpg",
    ]) {
      expect(isSafeKey(key), key).toBe(false);
    }
  });

  it("rejects null bytes, newlines and other control characters", () => {
    for (const key of [
      "photos/x.jpg\u0000.php",
      "photos/x\n.jpg",
      "photos/x\r\nHost: evil",
      "photos/x\u0007.jpg",
    ]) {
      expect(isSafeKey(key), JSON.stringify(key)).toBe(false);
    }
  });

  it("rejects keys that could confuse a URL or a header", () => {
    for (const key of [
      "photos/x .jpg",
      "photos/x?y.jpg",
      "photos/x#y.jpg",
      "photos/x;y.jpg",
      "photos/x%2e%2e/y.jpg",
      "photos/ünïcode.jpg",
      "",
      "/",
      "photos/",
      "photos/x.",
    ]) {
      expect(isSafeKey(key), JSON.stringify(key)).toBe(false);
    }
  });

  it("rejects an absurdly long key rather than passing it to the filesystem", () => {
    expect(isSafeKey(`photos/${"a".repeat(300)}.jpg`)).toBe(false);
  });
});
