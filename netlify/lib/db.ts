// Database access. Production uses Netlify Database (Postgres, provisioned on deploy);
// tests swap in an in-memory Postgres through setSql().
import { getDatabase } from '@netlify/database';

export type Row = Record<string, any>;
export type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;

let override: Sql | null = null;
export const setSql = (fn: Sql | null) => { override = fn; };

export const sql: Sql = (strings, ...values) => {
  if (override) return override(strings, ...values);
  return getDatabase().sql(strings, ...values) as unknown as Promise<Row[]>;
};

export const one = async (strings: TemplateStringsArray, ...values: unknown[]) => (await sql(strings, ...values))[0] ?? null;
