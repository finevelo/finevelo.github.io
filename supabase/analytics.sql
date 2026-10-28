-- Finevelo analytics: cookieless page views, no IP addresses stored.
-- Run once in Supabase → SQL Editor. Safe to run again.

create table if not exists public.fv_pageviews (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  path text not null,
  ref text not null default '',      -- referring site (host only) or utm_source
  visitor text not null,             -- daily-rotating hash, cannot be linked across days
  device text not null default '',   -- mobile | tablet | desktop
  lang text not null default ''      -- browser language, two letters
);
create index if not exists fv_pageviews_ts on public.fv_pageviews (ts);

-- One random salt per day; deleted after two days so old hashes can never be recomputed.
create table if not exists public.fv_salts (
  day date primary key,
  salt text not null
);

-- Who may read the numbers in the backend.
create table if not exists public.fv_admins (
  email text primary key
);
insert into public.fv_admins (email) values ('fm@nonpluscomponents.com'), ('mw@nonpluscomponents.com')
on conflict do nothing;

-- No policies: only the server-side function (service role) can read or write these tables.
alter table public.fv_pageviews enable row level security;
alter table public.fv_salts enable row level security;
alter table public.fv_admins enable row level security;

-- Aggregated numbers for the backend. Raw rows never leave the database.
create or replace function public.fv_stats(days int default 30)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  since timestamptz := date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin' - make_interval(days => greatest(days, 1) - 1);
  prev timestamptz := since - make_interval(days => greatest(days, 1));
begin
  if not exists (select 1 from fv_admins where email = lower(coalesce(auth.jwt() ->> 'email', ''))) then
    raise exception 'not allowed';
  end if;
  return json_build_object(
    'since', since,
    'totals', (select json_build_object('views', count(*), 'visitors', count(distinct visitor || (ts at time zone 'Europe/Berlin')::date))
               from fv_pageviews where ts >= since),
    'previous', (select json_build_object('views', count(*), 'visitors', count(distinct visitor || (ts at time zone 'Europe/Berlin')::date))
                 from fv_pageviews where ts >= prev and ts < since),
    'daily', (select coalesce(json_agg(d order by d.day), '[]') from (
                select g::date as day,
                       count(p.id) as views,
                       count(distinct p.visitor) as visitors
                from generate_series((since at time zone 'Europe/Berlin')::date, (now() at time zone 'Europe/Berlin')::date, interval '1 day') g
                left join fv_pageviews p on (p.ts at time zone 'Europe/Berlin')::date = g::date
                group by g) d),
    'pages', (select coalesce(json_agg(x), '[]') from (
                select path, count(*) as views, count(distinct visitor || (ts at time zone 'Europe/Berlin')::date) as visitors
                from fv_pageviews where ts >= since group by path order by views desc limit 20) x),
    'refs', (select coalesce(json_agg(x), '[]') from (
                select ref, count(distinct visitor || (ts at time zone 'Europe/Berlin')::date) as visitors
                from fv_pageviews where ts >= since group by ref order by visitors desc limit 12) x),
    'devices', (select coalesce(json_agg(x), '[]') from (
                select device, count(distinct visitor || (ts at time zone 'Europe/Berlin')::date) as visitors
                from fv_pageviews where ts >= since group by device order by visitors desc) x),
    'langs', (select coalesce(json_agg(x), '[]') from (
                select lang, count(distinct visitor || (ts at time zone 'Europe/Berlin')::date) as visitors
                from fv_pageviews where ts >= since group by lang order by visitors desc limit 8) x),
    'live', (select count(distinct visitor) from fv_pageviews where ts >= now() - interval '5 minutes')
  );
end;
$$;

revoke all on function public.fv_stats(int) from public, anon;
grant execute on function public.fv_stats(int) to authenticated;
