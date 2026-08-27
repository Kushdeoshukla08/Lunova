import { describe, expect, it, vi } from "vitest";
import { realtime, publishToMany } from "./provider";
import type { RealtimeEvent } from "./types";

const ping: RealtimeEvent = { type: "ping" };

describe("InProcessRealtimeProvider", () => {
  it("delivers only to the addressed user", async () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = realtime.subscribe("user-a", a);
    const offB = realtime.subscribe("user-b", b);

    await realtime.publish("user-a", ping);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();

    offA();
    offB();
  });

  it("fans out to every connection a user has open", async () => {
    const tab1 = vi.fn();
    const tab2 = vi.fn();
    const off1 = realtime.subscribe("multi", tab1);
    const off2 = realtime.subscribe("multi", tab2);
    expect(realtime.connectionCount("multi")).toBe(2);

    await realtime.publish("multi", ping);
    expect(tab1).toHaveBeenCalledTimes(1);
    expect(tab2).toHaveBeenCalledTimes(1);

    off1();
    off2();
    expect(realtime.connectionCount("multi")).toBe(0);
  });

  it("unsubscribing stops delivery and cleans up", async () => {
    const fn = vi.fn();
    const off = realtime.subscribe("gone", fn);
    off();
    await realtime.publish("gone", ping);
    expect(fn).not.toHaveBeenCalled();
    expect(realtime.connectionCount("gone")).toBe(0);
  });

  it("publishing to a user with no connections is a no-op", async () => {
    await expect(realtime.publish("nobody", ping)).resolves.toBeUndefined();
  });

  it("a throwing listener cannot break delivery to the others", async () => {
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();
    const off1 = realtime.subscribe("mixed", bad);
    const off2 = realtime.subscribe("mixed", good);

    await expect(realtime.publish("mixed", ping)).resolves.toBeUndefined();
    expect(good).toHaveBeenCalledTimes(1);

    off1();
    off2();
  });

  it("publishToMany reaches every listed user", async () => {
    const x = vi.fn();
    const y = vi.fn();
    const offX = realtime.subscribe("x", x);
    const offY = realtime.subscribe("y", y);

    await publishToMany(["x", "y", "unknown"], ping);
    expect(x).toHaveBeenCalledTimes(1);
    expect(y).toHaveBeenCalledTimes(1);

    offX();
    offY();
  });
});
