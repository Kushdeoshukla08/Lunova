/** Great-circle distance in km. Both points must be present. */
export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Coarse, privacy-preserving distance phrasing. Never a precise number below the
 * "Nearby" threshold. `units` follows the viewer's regional convention and
 * defaults to metric, so existing callers and tests are unaffected.
 */
export function describeDistance(
  km: number | null,
  precision: string,
  units: "metric" | "imperial" = "metric",
): string | null {
  if (km == null) return null;

  if (units === "imperial") {
    const mi = km * 0.621371;
    if (mi < 1) return "Nearby";
    const step = precision === "REGION" ? 15 : precision === "NEIGHBORHOOD" ? 1 : 3;
    return `${Math.max(1, Math.round(mi / step) * step)} mi away`;
  }

  if (km < 2) return "Nearby";
  const step = precision === "REGION" ? 25 : precision === "NEIGHBORHOOD" ? 1 : 5;
  return `${Math.max(2, Math.round(km / step) * step)} km away`;
}

export function ageFromBirthdate(birthdate: Date, now = new Date()): number {
  let age = now.getFullYear() - birthdate.getFullYear();
  const m = now.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthdate.getDate())) age--;
  return age;
}

/**
 * Coarse age phrasing for members who turned off "show my exact age".
 * Matching still uses the real birthdate — this only changes what is *shown*,
 * the same way `describeDistance` blurs a precise coordinate.
 *
 * Deliberately a third of a decade, not a two-year window: a band narrow enough
 * to be re-derived is not a privacy control.
 */
export function describeAgeBand(age: number): string {
  if (age < 20) return "late teens";
  const decade = Math.floor(age / 10) * 10;
  const within = age % 10;
  const part = within <= 3 ? "early" : within <= 6 ? "mid" : "late";
  return `${part} ${decade}s`;
}
