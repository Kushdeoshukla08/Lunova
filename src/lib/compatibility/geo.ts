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

/** Coarse, privacy-preserving distance phrasing. Never a precise number below 2 km. */
export function describeDistance(km: number | null, precision: string): string | null {
  if (km == null) return null;
  if (km < 2) return "Nearby";
  const rounded =
    precision === "REGION"
      ? Math.round(km / 25) * 25
      : precision === "NEIGHBORHOOD"
        ? Math.round(km)
        : Math.round(km / 5) * 5;
  return `${Math.max(2, rounded)} km away`;
}

export function ageFromBirthdate(birthdate: Date, now = new Date()): number {
  let age = now.getFullYear() - birthdate.getFullYear();
  const m = now.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthdate.getDate())) age--;
  return age;
}
