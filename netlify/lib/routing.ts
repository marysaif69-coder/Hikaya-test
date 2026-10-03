// Route planning for the delivery app. With GOOGLE_MAPS_API_KEY set, Google's Routes API puts each
// time window's stops in the shortest driving order (starting from the shop, or from the driver's
// location) and gives the distance and driving time. Without it, stops go by time window and then
// postal code, and only the odometer gives the distance.
import { env } from './http';

export type Stop = { ref: string; address: string; window: string; postal: string };
export type Origin = { address?: string; lat?: number; lng?: number; label: string };
export type Plan = { order: string[]; meters: number | null; seconds: number | null; optimized: boolean; legs: { ref: string; meters: number | null; seconds: number | null }[]; returnMeters: number | null };

const WINDOWS = ['11:00–14:00', '14:00–17:00', '17:00–20:00'];
export const mapsEnabled = () => Boolean(env('GOOGLE_MAPS_API_KEY'));
export const shopAddress = () => env('SHOP_ADDRESS');

const point = (o: Origin | string) => typeof o === 'string' ? { address: o }
  : o.lat !== undefined && o.lng !== undefined ? { location: { latLng: { latitude: o.lat, longitude: o.lng } } } : { address: o.address ?? '' };

async function computeRoute(origin: Origin | string, stops: Stop[]) {
  const r = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env('GOOGLE_MAPS_API_KEY'), 'x-goog-fieldmask': 'routes.optimizedIntermediateWaypointIndex,routes.legs.distanceMeters,routes.legs.duration' },
    body: JSON.stringify({
      origin: point(origin), destination: point(origin), intermediates: stops.map(s => ({ address: s.address })),
      travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE', optimizeWaypointOrder: stops.length > 1, regionCode: 'ca', units: 'METRIC',
    }),
  });
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok || !d.routes?.[0]) throw new Error(`Routes API: ${JSON.stringify(d.error ?? d).slice(0, 200)}`);
  const route = d.routes[0];
  const idx: number[] = route.optimizedIntermediateWaypointIndex?.length ? route.optimizedIntermediateWaypointIndex : stops.map((_, i) => i);
  const legs = (route.legs ?? []).map((l: any) => ({ meters: Number(l.distanceMeters ?? 0), seconds: Number(String(l.duration ?? '0s').replace('s', '')) }));
  return { ordered: idx.map(i => stops[i]), legs }; // legs: origin→1st, …, last→origin (the way back)
}

/** Plans the day: window by window, each starting where the last one ended. */
export async function planRoute(stops: Stop[], origin: Origin | null): Promise<Plan> {
  const byWindow = (a: Stop, b: Stop) => (WINDOWS.indexOf(a.window) - WINDOWS.indexOf(b.window)) || a.postal.localeCompare(b.postal);
  const simple = [...stops].sort(byWindow);
  const start: Origin | null = origin ?? (shopAddress() ? { address: shopAddress(), label: 'Shop' } : null);
  if (!mapsEnabled() || !stops.length || !start) return { order: simple.map(s => s.ref), meters: null, seconds: null, optimized: false, legs: simple.map(s => ({ ref: s.ref, meters: null, seconds: null })), returnMeters: null };
  try {
    const order: Stop[] = [], legs: Plan['legs'] = [];
    let meters = 0, seconds = 0, returnMeters: number | null = null, from: Origin | string = start;
    const groups = WINDOWS.map(w => stops.filter(s => s.window === w)).filter(g => g.length);
    const other = stops.filter(s => !WINDOWS.includes(s.window)); if (other.length) groups.push(other);
    for (const [gi, group] of groups.entries()) {
      for (let i = 0; i < group.length; i += 25) { // the planner takes 25 stops at a time
        const chunk = group.slice(i, i + 25);
        const { ordered, legs: l } = await computeRoute(from, chunk);
        ordered.forEach((s, k) => { order.push(s); legs.push({ ref: s.ref, meters: l[k]?.meters ?? null, seconds: l[k]?.seconds ?? null }); meters += l[k]?.meters ?? 0; seconds += l[k]?.seconds ?? 0; });
        const last = gi === groups.length - 1 && i + 25 >= group.length;
        if (last && shopAddress()) { returnMeters = l[l.length - 1]?.meters ?? 0; meters += l[l.length - 1]?.meters ?? 0; seconds += l[l.length - 1]?.seconds ?? 0; } // the drive back to the shop
        from = ordered[ordered.length - 1].address;
      }
    }
    return { order: order.map(s => s.ref), meters, seconds, optimized: true, legs, returnMeters };
  } catch (e) {
    console.error(e);
    return { order: simple.map(s => s.ref), meters: null, seconds: null, optimized: false, legs: simple.map(s => ({ ref: s.ref, meters: null, seconds: null })), returnMeters: null };
  }
}

/** Google Maps navigation links, at most 10 stops each (Maps' limit), in driving order. */
export function navLinks(addresses: string[]) {
  const out: { label: string; url: string }[] = [];
  for (let i = 0; i < addresses.length; i += 10) {
    const chunk = addresses.slice(i, i + 10), dest = chunk[chunk.length - 1], way = chunk.slice(0, -1);
    const origin = i > 0 ? `&origin=${encodeURIComponent(addresses[i - 1])}` : '';
    out.push({ label: addresses.length > 10 ? `Stops ${i + 1}–${i + chunk.length}` : 'Navigate all stops', url: `https://www.google.com/maps/dir/?api=1&travelmode=driving${origin}&destination=${encodeURIComponent(dest)}${way.length ? `&waypoints=${encodeURIComponent(way.join('|'))}` : ''}` });
  }
  return out;
}
