import "server-only";

/**
 * A tiny in-process metrics registry. No dependencies, no vendor. It exposes
 * counters / gauges / histograms in Prometheus text format at GET /api/metrics
 * (token-gated) so any Prometheus-compatible scraper — or the Grafana Agent, or
 * a hosted equivalent — can pull them.
 *
 * Deliberately process-local: values reset on deploy. For a single always-on
 * container (docs/DEPLOYMENT.md) that's fine; a multi-replica future aggregates
 * at the scraper. These are SYSTEM metrics (latencies, provider health, queue
 * depth) — never a per-user event stream.
 */

type Labels = Record<string, string>;

function key(name: string, labels?: Labels): string {
  if (!labels || Object.keys(labels).length === 0) return name;
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${JSON.stringify(String(labels[k]))}`);
  return `${name}{${parts.join(",")}}`;
}

interface Series {
  name: string;
  help: string;
  type: "counter" | "gauge" | "histogram";
}

const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10_000];

class Registry {
  private series = new Map<string, Series>();
  private values = new Map<string, number>();
  private histos = new Map<
    string,
    { buckets: number[]; counts: number[]; sum: number; count: number; labels?: Labels }
  >();

  private ensure(name: string, help: string, type: Series["type"]): void {
    if (!this.series.has(name)) this.series.set(name, { name, help, type });
  }

  increment(name: string, labels?: Labels, help = name, by = 1): void {
    this.ensure(name, help, "counter");
    const k = key(name, labels);
    this.values.set(k, (this.values.get(k) ?? 0) + by);
  }

  setGauge(name: string, value: number, labels?: Labels, help = name): void {
    this.ensure(name, help, "gauge");
    this.values.set(key(name, labels), value);
  }

  addGauge(name: string, delta: number, labels?: Labels, help = name): void {
    this.ensure(name, help, "gauge");
    const k = key(name, labels);
    this.values.set(k, (this.values.get(k) ?? 0) + delta);
  }

  observe(name: string, value: number, labels?: Labels, help = name, buckets = DEFAULT_BUCKETS): void {
    this.ensure(name, help, "histogram");
    const k = key(name, labels);
    let h = this.histos.get(k);
    if (!h) {
      h = { buckets, counts: new Array(buckets.length).fill(0), sum: 0, count: 0, labels };
      this.histos.set(k, h);
    }
    h.sum += value;
    h.count += 1;
    for (let i = 0; i < h.buckets.length; i++) {
      if (value <= h.buckets[i]) h.counts[i] += 1;
    }
  }

  /** Time an async fn into a histogram; records success/error as a label. */
  async time<T>(name: string, labels: Labels, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const out = await fn();
      this.observe(name, Date.now() - start, { ...labels, outcome: "ok" });
      return out;
    } catch (err) {
      this.observe(name, Date.now() - start, { ...labels, outcome: "error" });
      throw err;
    }
  }

  render(): string {
    const lines: string[] = [];
    const emittedHelp = new Set<string>();

    const helpBlock = (name: string) => {
      if (emittedHelp.has(name)) return;
      const s = this.series.get(name);
      if (s) {
        lines.push(`# HELP ${name} ${s.help}`);
        lines.push(`# TYPE ${name} ${s.type}`);
      }
      emittedHelp.add(name);
    };

    for (const [k, v] of this.values) {
      const name = k.includes("{") ? k.slice(0, k.indexOf("{")) : k;
      helpBlock(name);
      lines.push(`${k} ${v}`);
    }

    for (const [k, h] of this.histos) {
      const name = k.includes("{") ? k.slice(0, k.indexOf("{")) : k;
      helpBlock(name);
      const labelInner = k.includes("{") ? k.slice(k.indexOf("{") + 1, -1) : "";
      const withLe = (le: string) =>
        labelInner ? `${name}{${labelInner},le=${JSON.stringify(le)}}` : `${name}{le=${JSON.stringify(le)}}`;
      for (let i = 0; i < h.buckets.length; i++) {
        lines.push(`${withLe(String(h.buckets[i]))} ${h.counts[i]}`);
      }
      lines.push(`${withLe("+Inf")} ${h.count}`);
      lines.push(`${name}_sum${labelInner ? `{${labelInner}}` : ""} ${h.sum}`);
      lines.push(`${name}_count${labelInner ? `{${labelInner}}` : ""} ${h.count}`);
    }

    return lines.join("\n") + "\n";
  }

  /** Tests only. */
  reset(): void {
    this.series.clear();
    this.values.clear();
    this.histos.clear();
  }
}

const g = globalThis as unknown as { __lunovaMetrics?: Registry };
export const metrics: Registry = g.__lunovaMetrics ?? (g.__lunovaMetrics = new Registry());
