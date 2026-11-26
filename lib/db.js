import { neon } from '@neondatabase/serverless';
import { HttpError } from './http.js';

let client, ready;

export async function db() {
  if (!client) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new HttpError(503, 'Database not connected. Add a Neon database to this project in Vercel (Storage tab), then redeploy.');
    client = neon(url);
  }
  if (!ready) ready = ensureSchema(client).catch((e) => { ready = null; throw e; });
  await ready;
  return client;
}

async function ensureSchema(sql) {
  await sql.query(`create table if not exists visits (
    id text primary key,
    visitor_id text,
    created_at timestamptz not null default now(),
    device text,
    source text,
    campaign text,
    ad text,
    referrer text,
    path text,
    vsl_played boolean not null default false,
    vsl_max real not null default 0,
    vsl_dur real not null default 0,
    buttons text[] not null default '{}',
    form_started boolean not null default false,
    form_step int not null default 0,
    submitted boolean not null default false,
    booked boolean not null default false,
    booked_at timestamptz
  )`);
  await sql.query(`create index if not exists visits_created_at on visits (created_at)`);
  // true when the form ended without the calendar (e.g. "can't afford that level of investment")
  await sql.query(`alter table visits add column if not exists no_calendar boolean not null default false`);
  await sql.query(`create table if not exists leads (
    id bigserial primary key,
    visit_id text unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    status text not null default 'partial',
    name text,
    email text,
    phone text,
    sms_consent boolean,
    booked boolean not null default false,
    answers jsonb not null default '{}',
    source text,
    campaign text,
    ad text
  )`);
  await sql.query(`create index if not exists leads_updated_at on leads (updated_at)`);
  await sql.query(`alter table leads add column if not exists score int`);
  await sql.query(`alter table leads add column if not exists device text`);
  await sql.query(`alter table leads add column if not exists form_seconds int`);
  await sql.query(`alter table leads add column if not exists dropoff_sent boolean not null default false`);
  await sql.query(`create table if not exists kv (
    key text primary key,
    value jsonb,
    updated_at timestamptz not null default now()
  )`);
}
