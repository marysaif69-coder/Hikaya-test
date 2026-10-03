// Phone notifications for the team app (Web Push). Works on Android, and on iPhone once the team
// app is added to the home screen (iOS 16.4+). Each person turns them on per device in Me.
// The site's key pair comes from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY if set in Netlify, otherwise
// it is made once and kept in the database (push_keys; left out of the backup).
import webpush from 'web-push';
import { sql, one } from './db';
import { env, HttpError, str } from './http';
import { roleFor } from './auth';

let keys: { publicKey: string; privateKey: string } | null = null;

export async function pushKeys() {
  if (env('VAPID_PUBLIC_KEY') && env('VAPID_PRIVATE_KEY')) return { publicKey: env('VAPID_PUBLIC_KEY'), privateKey: env('VAPID_PRIVATE_KEY') };
  if (keys) return keys;
  let r = await one`SELECT public_key, private_key FROM push_keys WHERE id = 1`;
  if (!r) {
    const k = webpush.generateVAPIDKeys();
    await sql`INSERT INTO push_keys (id, public_key, private_key) VALUES (1, ${k.publicKey}, ${k.privateKey}) ON CONFLICT (id) DO NOTHING`;
    r = await one`SELECT public_key, private_key FROM push_keys WHERE id = 1`;
  }
  return (keys = { publicKey: r!.public_key, privateKey: r!.private_key });
}

export async function subscribe(email: string, b: any) {
  const endpoint = str(b?.endpoint, 1000), p256dh = str(b?.keys?.p256dh, 200), auth = str(b?.keys?.auth, 100);
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) throw new HttpError(400, 'push', 'This phone could not turn on notifications.');
  await sql`INSERT INTO push_subs (email, endpoint, p256dh, auth, device) VALUES (${email}, ${endpoint}, ${p256dh}, ${auth}, ${str(b?.device, 120) || null})
    ON CONFLICT (endpoint) DO UPDATE SET email = EXCLUDED.email, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, device = EXCLUDED.device`;
  return { ok: true };
}
export async function unsubscribe(email: string, endpoint: unknown) {
  await sql`DELETE FROM push_subs WHERE email = ${email} AND endpoint = ${str(endpoint, 1000)}`;
  return { ok: true };
}
export async function pushStatus(email: string) {
  const r = await one`SELECT COUNT(*)::int AS n FROM push_subs WHERE email = ${email}`;
  return { devices: r!.n as number };
}

export type Push = { title: string; body: string; url?: string; tag?: string };

/** For tests: replaces the sender. */
let sender: (sub: webpush.PushSubscription, payload: string, opts: webpush.RequestOptions) => Promise<unknown> = (s, p, o) => webpush.sendNotification(s, p, o);
export const setPushSender = (f: typeof sender) => { sender = f; };

/** Sends to every device of these people. Never throws: a failed push must not stop the work it
 * reports on. Devices the push service says are gone are removed. */
export async function pushTo(emails: string[], msg: Push) {
  const list = [...new Set(emails.filter(Boolean).map(e => e.toLowerCase()))];
  if (!list.length) return 0;
  try {
    const subs = await sql`SELECT id, endpoint, p256dh, auth FROM push_subs WHERE email = ANY(${list})`;
    if (!subs.length) return 0;
    const k = await pushKeys();
    const opts = { vapidDetails: { subject: `mailto:${env('EMAIL_REPLY_TO') || 'hello@hikayacoffee.ca'}`, publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 6 * 3600 };
    const payload = JSON.stringify({ ...msg, url: msg.url ?? '/admin/driver/' });
    let n = 0;
    for (const s of subs) {
      try {
        await sender({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, opts);
        await sql`UPDATE push_subs SET last_sent_at = NOW() WHERE id = ${s.id}`; n++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await sql`DELETE FROM push_subs WHERE id = ${s.id}`;
        else console.error('push', e?.statusCode ?? e);
      }
    }
    return n;
  } catch (e) { console.error('push', e); return 0; }
}

/** Every subscribed device of the team. */
export async function pushTeam(msg: Push) {
  const rows = await sql`SELECT DISTINCT email FROM push_subs`;
  return pushTo(rows.map(r => r.email as string), msg);
}
/** Subscribed owners only (new orders). */
export async function pushOwners(msg: Push) {
  const rows = await sql`SELECT DISTINCT email FROM push_subs`;
  const owners: string[] = [];
  for (const r of rows) if (await roleFor(r.email) === 'admin') owners.push(r.email);
  return pushTo(owners, msg);
}
