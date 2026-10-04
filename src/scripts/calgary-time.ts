// Calgary wall time ("2027-02-11 09:00") to and from UTC, whatever time zone the browser is in.
const TZ = 'America/Edmonton';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const parts = (d: Date) => Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));

/** An ISO time shown as "YYYY-MM-DD HH:MM" in Calgary ('' for none). */
export function isoToCalgary(iso: string | null | undefined) {
  if (!iso) return '';
  const p = parts(new Date(iso));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** "YYYY-MM-DD HH:MM" in Calgary to an ISO time; '' → null; anything else → undefined (not valid). */
export function calgaryToIso(v: string): string | null | undefined {
  const s = v.trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(s);
  if (!m) return undefined;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return undefined;
  // Treat the typed time as UTC, see what Calgary shows for that moment, and shift by the difference.
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const p = parts(new Date(guess));
  const shown = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return new Date(guess - (shown - guess)).toISOString();
}
