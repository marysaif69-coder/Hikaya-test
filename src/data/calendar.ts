// Calgary calendar: sunset (iftar) times for Ramadan 1448 and pickup slots.
// Ramadan and Eid dates are expected dates; the moon decides.

export const CALGARY = { lat: 51.0447, lon: -114.0719 };
export const RAMADAN_START = '2027-02-08'; // expected first fast
export const RAMADAN_DAYS = 30;
export const EID = '2027-03-09'; // expected
export const PICKUP_FROM = '2027-01-22';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** NOAA solar position: sunset for a date, as minutes after local midnight (UTC offset in hours). */
export function sunsetMinutes(isoDate: string, utcOffset = -7, { lat, lon } = CALGARY): number {
  const d = new Date(isoDate + 'T12:00:00Z');
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const N = Math.floor((d.getTime() - start) / 86400000);
  const g = ((2 * Math.PI) / 365) * (N - 1);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = Math.acos(Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(decl)) - Math.tan(rad(lat)) * Math.tan(decl));
  const sunsetUtc = 720 - 4 * (lon - deg(ha)) - eqt;
  return Math.round(sunsetUtc + utcOffset * 60);
}

export const hhmm = (m: number) => {
  const h = Math.floor(m / 60), mm = m % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, '0')}`;
};

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const weekday = (iso: string, lang: 'en' | 'ar', style: 'long' | 'short' = 'short') =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString(lang === 'ar' ? 'ar-u-nu-arab' : 'en-CA', { weekday: style, timeZone: 'UTC' });
export const dayMonth = (iso: string, lang: 'en' | 'ar') =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString(lang === 'ar' ? 'ar-u-nu-arab' : 'en-CA', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Pickup and delivery run Thursday to Sunday. */
export const isServiceDay = (iso: string) => [0, 4, 5, 6].includes(new Date(iso + 'T12:00:00Z').getUTCDay());

export function ramadanTable() {
  return Array.from({ length: RAMADAN_DAYS }, (_, i) => {
    const iso = addDays(RAMADAN_START, i);
    return { day: i + 1, iso, sunset: sunsetMinutes(iso), service: isServiceDay(iso) };
  });
}

export function pickupSlots(weeks = 8) {
  const out: { iso: string; windows: string[] }[] = [];
  for (let i = 0; out.length < weeks * 4; i++) {
    const iso = addDays(PICKUP_FROM, i);
    if (isServiceDay(iso)) out.push({ iso, windows: ['11:00–14:00', '14:00–17:00', '17:00–20:00'] });
  }
  return out;
}
