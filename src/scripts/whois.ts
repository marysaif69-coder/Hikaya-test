// A shared team login (e.g. hello@hikayacoffee.ca): after logging in, each person picks their name
// so what they do is credited to them. Used by the order desk and the team app.
type Person = { id: number; name: string; drives: boolean };
type Me = { user: { email: string; role: string; login: string; as?: { id: number; name: string } } | null; people: Person[] };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const SKIP = 'hk-who-skip';
export const skipped = () => { try { return localStorage.getItem(SKIP) === '1'; } catch { return false; } };
export async function pick(id: number | null) {
  try { if (id) localStorage.removeItem(SKIP); else localStorage.setItem(SKIP, '1'); } catch { /* private mode */ }
  const r = await fetch('/api/auth/as', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message ?? 'Something went wrong.');
  if (!id) location.reload();
  return d as { sent: boolean; to: string };
}
async function confirm(id: number, code: string) {
  const r = await fetch('/api/auth/as/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, code }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message ?? 'That code is not right.');
  location.reload();
}

/** Shows the "Who's working?" screen. Resolves only if nobody needs to be picked. */
export function askWho(me: Me, force = false) {
  if (!me.user || !me.people.length || ((me.user.as || skipped()) && !force)) return;
  const box = document.createElement('div');
  box.className = 'whois';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'whoisTitle');
  box.innerHTML = `<div class="whois-card"><h2 id="whoisTitle">Who's working?</h2><p>You're logged in as ${esc(me.user.login)}. Pick your name; we'll send a code to your own email to confirm it's you.</p>
    <div class="whois-list">${me.people.map(p => `<button type="button" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div>
    <button type="button" class="whois-skip" data-id="0">Not on the list</button></div>`;
  const st = document.createElement('style');
  st.textContent = `.whois{position:fixed;inset:0;z-index:100;background:rgba(51,33,26,.55);display:grid;place-items:center;padding:16px}
    .whois-card{background:#FBF8F1;color:#33211A;border-radius:24px;padding:24px;max-width:420px;width:100%;display:grid;gap:12px;font:16px/1.45 Arial,sans-serif}
    .whois-card h2{margin:0;font-size:24px}.whois-card p{margin:0;color:#66503F}
    .whois-list{display:grid;gap:8px}.whois-list button{min-height:54px;border:0;border-radius:14px;background:#33211A;color:#F5EFE3;font:inherit;font-weight:700;font-size:18px}
    .whois-skip{border:0;background:none;color:#66503F;text-decoration:underline;font:inherit}
    .whois-code{display:flex;gap:8px}.whois-code input{flex:1;min-width:0;width:100%;font-size:26px;letter-spacing:.3em;text-align:center;border:1.5px solid #DFD1BA;border-radius:12px;padding:10px}.whois-code button{border:0;border-radius:12px;background:#33211A;color:#F5EFE3;font:inherit;font-weight:700;padding:0 18px}.whois-err{color:#A93B28;font-weight:700}`;
  box.prepend(st);
  const card = box.querySelector<HTMLElement>('.whois-card')!;
  box.addEventListener('click', async e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-id]'); if (!b) return;
    const id = Number(b.dataset.id) || null;
    if (!id) { await pick(null); return; }
    const name = me.people.find(p => p.id === id)?.name ?? '';
    try {
      const sent = await pick(id);
      card.innerHTML = `<h2 id="whoisTitle">Hi ${esc(name)}</h2><p>We sent a 6-digit code to your own email (${esc(sent.to)}). Type it here to confirm it's you.</p>
        <form class="whois-code"><input inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" aria-label="Code" required /><button type="submit">Confirm</button></form>
        <p class="whois-err" hidden></p><button type="button" class="whois-skip" data-back="1">Back</button>`;
      const f = card.querySelector('form')!, inp = f.querySelector('input')!, err = card.querySelector<HTMLElement>('.whois-err')!;
      inp.focus();
      f.addEventListener('submit', async ev => { ev.preventDefault(); try { await confirm(id, inp.value.trim()); } catch (x) { err.textContent = (x as Error).message; err.hidden = false; } });
      card.querySelector('[data-back]')!.addEventListener('click', () => { box.remove(); askWho(me, true); });
    } catch (x) { alert((x as Error).message); }
  });
  document.body.append(box);
  box.querySelector<HTMLButtonElement>('button')?.focus();
}

export const whoLabel = (me: Me) => me.user?.as ? `${me.user.as.name} · ${me.user.login}` : me.user?.login ?? '';
