import "server-only";

export interface GeocodeResult {
  city: string;
  region: string | null;
  country: string; // ISO 3166-1 alpha-2
  latitude: number;
  longitude: number;
  timezone: string | null;
}

export interface GeocodeProvider {
  readonly name: string;
  /** Resolve a free-text place to a coarse location, or null if unknown. */
  lookup(query: string): Promise<GeocodeResult | null>;
}

/**
 * DEV provider — a tiny built-in gazetteer so distance/compatibility can be
 * exercised locally without an external geocoding API. Swap for a real provider
 * (Mapbox / Nominatim / Google) in production via GEOCODE_PROVIDER.
 */
const GAZETTEER: Record<string, Omit<GeocodeResult, "city">> = {
  lisbon: { region: null, country: "PT", latitude: 38.7223, longitude: -9.1393, timezone: "Europe/Lisbon" },
  berlin: { region: null, country: "DE", latitude: 52.52, longitude: 13.405, timezone: "Europe/Berlin" },
  "mexico city": { region: null, country: "MX", latitude: 19.4326, longitude: -99.1332, timezone: "America/Mexico_City" },
  london: { region: "England", country: "GB", latitude: 51.5072, longitude: -0.1276, timezone: "Europe/London" },
  "new york": { region: "NY", country: "US", latitude: 40.7128, longitude: -74.006, timezone: "America/New_York" },
  "san francisco": { region: "CA", country: "US", latitude: 37.7749, longitude: -122.4194, timezone: "America/Los_Angeles" },
  toronto: { region: "ON", country: "CA", latitude: 43.6532, longitude: -79.3832, timezone: "America/Toronto" },
  bengaluru: { region: "KA", country: "IN", latitude: 12.9716, longitude: 77.5946, timezone: "Asia/Kolkata" },
  mumbai: { region: "MH", country: "IN", latitude: 19.076, longitude: 72.8777, timezone: "Asia/Kolkata" },
  delhi: { region: "DL", country: "IN", latitude: 28.6139, longitude: 77.209, timezone: "Asia/Kolkata" },
  paris: { region: null, country: "FR", latitude: 48.8566, longitude: 2.3522, timezone: "Europe/Paris" },
  "são paulo": { region: "SP", country: "BR", latitude: -23.5558, longitude: -46.6396, timezone: "America/Sao_Paulo" },
  sydney: { region: "NSW", country: "AU", latitude: -33.8688, longitude: 151.2093, timezone: "Australia/Sydney" },
  tokyo: { region: null, country: "JP", latitude: 35.6762, longitude: 139.6503, timezone: "Asia/Tokyo" },
  amsterdam: { region: null, country: "NL", latitude: 52.3676, longitude: 4.9041, timezone: "Europe/Amsterdam" },
  barcelona: { region: "CT", country: "ES", latitude: 41.3874, longitude: 2.1686, timezone: "Europe/Madrid" },
};

class LocalGeocodeProvider implements GeocodeProvider {
  readonly name = "local";
  async lookup(query: string): Promise<GeocodeResult | null> {
    const key = query.trim().toLowerCase();
    const hit = GAZETTEER[key];
    if (!hit) return null;
    const city = key.replace(/\b\w/g, (c) => c.toUpperCase());
    return { city, ...hit };
  }
}

const globalForGeo = globalThis as unknown as { geocode?: GeocodeProvider };
export const geocode: GeocodeProvider =
  globalForGeo.geocode ?? (globalForGeo.geocode = new LocalGeocodeProvider());

export const KNOWN_CITIES = Object.keys(GAZETTEER).map((k) =>
  k.replace(/\b\w/g, (c) => c.toUpperCase()),
);
