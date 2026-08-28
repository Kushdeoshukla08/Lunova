import { describe, expect, it } from "vitest";
import { UNKNOWN_IP, clientIpFrom } from "./client-ip";

const h = (headers: Record<string, string>) => ({
  get: (name: string) => headers[name.toLowerCase()] ?? null,
});

describe("clientIpFrom", () => {
  it("takes the address the trusted proxy appended", () => {
    // Render appends the real peer; anything to its left came from the client.
    expect(clientIpFrom(h({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIpFrom(h({ "x-forwarded-for": "10.0.0.1, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("ignores a spoofed prefix — this is the rate-limit bypass", () => {
    // An attacker prepending a different value each request must still land in
    // the same bucket, or the per-IP login limit does not exist.
    const buckets = new Set(
      ["1.1.1.1", "2.2.2.2", "3.3.3.3"].map((spoof) =>
        clientIpFrom(h({ "x-forwarded-for": `${spoof}, 203.0.113.7` })),
      ),
    );
    expect(buckets).toEqual(new Set(["203.0.113.7"]));
  });

  it("never believes a client-supplied X-Real-IP", () => {
    // The old implementation preferred this header outright.
    expect(clientIpFrom(h({ "x-real-ip": "9.9.9.9" }))).toBe(UNKNOWN_IP);
    expect(
      clientIpFrom(h({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "203.0.113.7" })),
    ).toBe("203.0.113.7");
  });

  it("counts in further when a CDN fronts the platform", () => {
    const chain = "1.1.1.1, 203.0.113.7, 198.51.100.4";
    expect(clientIpFrom(h({ "x-forwarded-for": chain }), { trustedProxyHops: 2 })).toBe(
      "203.0.113.7",
    );
  });

  it("refuses to guess when the header is shorter than the trusted chain", () => {
    expect(
      clientIpFrom(h({ "x-forwarded-for": "203.0.113.7" }), { trustedProxyHops: 2 }),
    ).toBe(UNKNOWN_IP);
  });

  it("trusts nothing when the app is exposed directly", () => {
    expect(
      clientIpFrom(h({ "x-forwarded-for": "203.0.113.7" }), { trustedProxyHops: 0 }),
    ).toBe(UNKNOWN_IP);
  });

  it("falls back to one shared bucket rather than a fresh allowance", () => {
    expect(clientIpFrom(h({}))).toBe(UNKNOWN_IP);
    expect(clientIpFrom(h({ "x-forwarded-for": "" }))).toBe(UNKNOWN_IP);
    expect(clientIpFrom(h({ "x-forwarded-for": "not-an-ip" }))).toBe(UNKNOWN_IP);
    expect(clientIpFrom(h({ "x-forwarded-for": "999.1.1.1" }))).toBe(UNKNOWN_IP);
    expect(clientIpFrom(h({ "x-forwarded-for": "a".repeat(200) }))).toBe(UNKNOWN_IP);
  });

  it("normalises spellings of one address into one bucket", () => {
    const same = [
      "203.0.113.7",
      "203.0.113.7:44321",
      "::ffff:203.0.113.7",
      "  203.0.113.7  ",
    ].map((v) => clientIpFrom(h({ "x-forwarded-for": v })));
    expect(new Set(same)).toEqual(new Set(["203.0.113.7"]));

    const v6 = ["[2001:db8::1]:443", "2001:DB8::1"].map((v) =>
      clientIpFrom(h({ "x-forwarded-for": v })),
    );
    expect(new Set(v6)).toEqual(new Set(["2001:db8::1"]));
  });

  it("does not let a header injection attempt become a key", () => {
    for (const evil of ["203.0.113.7\r\nX-Admin: 1", "203.0.113.7\u0000", "<script>"]) {
      expect(clientIpFrom(h({ "x-forwarded-for": evil })), evil).toBe(UNKNOWN_IP);
    }
  });
});
