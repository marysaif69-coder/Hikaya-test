// Runs every question in knowledge/test-questions.json through the real Ask Hikaya (real model,
// in-memory database with one test order) and has a grader check each answer against its
// must / must-not lists. Costs real API usage (roughly $1 per full run).
//
//   npm run ask:eval            all questions
//   npm run ask:eval damaged    only ids containing "damaged"
//
// The key comes from ANTHROPIC_API_KEY, or, in a Claude Code cloud environment, from an
// "API credential" for api.anthropic.com (header x-api-key) that is added to requests on the
// way out, so the session never sees it. Without either, the first check below stops the run.
// Writes a report to knowledge/eval-report.md.
import { PGlite } from '@electric-sql/pglite';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import { setSql } from '../netlify/lib/db';

// Always call the real API directly (a coding session may point ANTHROPIC_BASE_URL elsewhere),
// and use a stand-in key when the real one is added outside this process.
process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
delete process.env.ANTHROPIC_AUTH_TOKEN;
process.env.ANTHROPIC_API_KEY ||= 'added-by-environment-credential';
delete process.env.RESEND_API_KEY; // never email anyone during a test run
process.env.ADMIN_EMAILS = 'team@hikaya.test';

const pg = new PGlite();
for (const dir of fs.readdirSync('netlify/database/migrations').sort()) await pg.exec(fs.readFileSync(`netlify/database/migrations/${dir}/migration.sql`, 'utf8'));
setSql(((s: TemplateStringsArray, ...v: unknown[]) => pg.sql(s, ...v).then(r => r.rows)) as any);
await pg.exec(`
  INSERT INTO customers (email, name, phone) VALUES ('layla@example.com', 'Layla Haddad', '403-555-0100');
  INSERT INTO orders (ref, customer_id, email, name, phone, lang, method, slot_date, slot_window, payment, subtotal_cents, delivery_cents, total_cents, guest_token_hash, status)
    VALUES ('HK-TEST1', 1, 'layla@example.com', 'Layla Haddad', '403-555-0100', 'en', 'pickup', '2027-02-11', '14:00–17:00', 'e-transfer', 8200, 0, 8200, 'x', 'confirmed');
  INSERT INTO order_items (order_id, product_id, name_en, name_ar, option, option_en, option_ar, qty, unit_cents) VALUES
    (1, 'najdi', 'Najdi', 'نجدية', 'dallah', 'Ground for the dallah', 'مطحون للدلّة', 2, 2400),
    (1, 'ramadan-box', 'Ramadan Date Box', 'صندوق تمر رمضان', 'khalas', 'Khalas', 'خلاص', 1, 3400);
  -- A delivered order from six days ago, for the "it arrived damaged" questions.
  INSERT INTO orders (ref, customer_id, email, name, phone, lang, method, street, postal, slot_date, slot_window, payment, subtotal_cents, delivery_cents, total_cents, guest_token_hash, status, payment_status)
    VALUES ('HK-PAST1', 1, 'layla@example.com', 'Layla Haddad', '403-555-0100', 'en', 'delivery', '12 Example St NW', 'T3H 2K1', (CURRENT_DATE - 6)::date, '14:00–17:00', 'e-transfer', 5800, 0, 5800, 'x', 'completed', 'paid');
  INSERT INTO order_items (order_id, product_id, name_en, name_ar, option, option_en, option_ar, qty, unit_cents) VALUES
    (2, 'najdi', 'Najdi', 'نجدية', 'dallah', 'Ground for the dallah', 'مطحون للدلّة', 1, 2400),
    (2, 'date-box', 'The Everyday Date Box', 'علبة التمر اليومية', 'sukkari', 'Sukkari', 'سكري', 1, 3400);
`);

const { openChat, askTurn } = await import('../netlify/lib/ask');
const client = new Anthropic();
// Ask Hikaya turns a failed model call into its polite fallback, which would grade as 40 quiet
// failures. Check the key and model first so a bad key stops the run with a clear message.
const askModel = process.env.ASK_MODEL || 'claude-opus-5-5';
try { await client.models.retrieve(askModel); }
catch (e: any) { console.error(`Cannot reach ${askModel}: ${e?.status ?? ''} ${e?.error?.error?.message ?? e?.message ?? e}`); process.exit(1); }
type Q = { id: string; lang: 'en' | 'ar'; q: string; must: string[]; must_not?: string[] };
const filter = process.argv[2] ?? '';
const all: Q[] = JSON.parse(fs.readFileSync('knowledge/test-questions.json', 'utf8')).questions;
const qs = all.filter(q => q.id.includes(filter));

async function grade(q: Q, reply: string, tools: string[]) {
  const res = await client.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: { type: 'object', properties: { pass: { type: 'boolean' }, reason: { type: 'string' } }, required: ['pass', 'reason'], additionalProperties: false } } },
    messages: [{ role: 'user', content:
      `You grade a customer-service assistant for Hikaya, a coffee and dates shop in Calgary.\n\nCustomer asked (${q.lang}):\n${q.q}\n\nAssistant replied:\n${reply}\n\nTools the assistant used: ${tools.join('; ') || 'none'}\n\nThe reply PASSES only if it does every MUST and none of the MUST NOT. Judge meaning, not exact wording. Asking for a missing detail first counts as doing a MUST that needs that detail.\nMUST:\n${q.must.map(m => '- ' + m).join('\n')}\nMUST NOT:\n${(q.must_not ?? []).map(m => '- ' + m).join('\n') || '- (nothing)'}\n\nGive pass and a one-sentence reason.` }],
  } as any);
  const text = (res.content as any[]).find(b => b.type === 'text')?.text ?? '{}';
  return JSON.parse(text) as { pass: boolean; reason: string };
}

const rows: string[] = [];
let passed = 0;
for (const q of qs) {
  const { chat } = await openChat(null, q.lang, `eval-${q.id}`, null);
  const t0 = Date.now();
  const { reply, actions } = await askTurn(chat, q.q, q.lang, null);
  const ms = Date.now() - t0;
  const stored = (await pg.query(`SELECT messages FROM chats WHERE id = $1`, [chat.id])).rows[0] as any;
  const tools = stored.messages.flatMap((m: any) => Array.isArray(m.content) ? m.content.filter((b: any) => b.type === 'tool_use').map((b: any) => `${b.name} ${JSON.stringify(b.input)}`) : []);
  const g = await grade(q, reply, [...tools, ...actions.map(a => `action:${a.type}`)])
    .catch((e: any) => ({ pass: false, reason: `Grader failed: ${e?.message ?? e}` }));
  if (g.pass) passed++;
  console.log(`${g.pass ? '✓' : '✗'} ${q.id.padEnd(20)} ${(ms / 1000).toFixed(1)}s  ${g.pass ? '' : g.reason}`);
  rows.push(`### ${g.pass ? '✓' : '✗'} ${q.id}\n\n**Q:** ${q.q}\n\n**A:** ${reply.replace(/\n/g, '  \n')}\n\n${tools.length ? `**Tools:** \`${tools.join('` · `')}\`\n\n` : ''}**Grader:** ${g.reason}\n`);
}
const summary = `${passed} of ${qs.length} passed`;
fs.writeFileSync('knowledge/eval-report.md', `# Ask Hikaya test run\n\n${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · model ${askModel} · ${summary}\n\n${rows.join('\n')}`);
console.log(`\n${summary}. Report: knowledge/eval-report.md`);
