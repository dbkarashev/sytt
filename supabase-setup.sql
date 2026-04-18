-- sytt — DB setup. Run once in Supabase SQL Editor.

-- 1. Table
create table if not exists public.stories (
  id uuid default gen_random_uuid() primary key,
  lat decimal(5,1) not null,
  lng decimal(5,1) not null,
  text text not null,
  feeling text,
  coped text,
  lang varchar(2) default 'en',
  created_at timestamptz default now(),
  ip_hash varchar(64)
);

-- Migration for existing tables (idempotent)
alter table public.stories add column if not exists feeling text;

-- 2. Indexes
create index if not exists idx_stories_location on public.stories (lat, lng);
create index if not exists idx_stories_created  on public.stories (created_at desc);

-- 3. RLS: public read, writes only via service role key (server API).
alter table public.stories enable row level security;

drop policy if exists "Anyone can read stories" on public.stories;
create policy "Anyone can read stories" on public.stories for select using (true);

-- 4. Seed 12 initial stories (idempotent — skipped if any already exist).
insert into public.stories (lat, lng, lang, text, coped)
select * from (values
  (55.8::decimal, 37.6::decimal, 'ru', 'Потерял работу после 8 лет. Семья не понимает. Чувствую себя невидимкой.', 'Начал гулять каждое утро. Мелочь, но помогает.'),
  (40.7,  -74.0, 'en', 'Laid off. 300 applications. Nothing. Savings running out.', 'Found a free community at the library. Just being around people helps.'),
  (51.5,   -0.1, 'en', 'Moved to a new country alone. No friends, no family nearby. The loneliness is overwhelming.', null),
  (-23.5, -46.6, 'en', 'Depression took everything from me. I can barely get out of bed.', 'One thing a day. Just one. Yesterday I cooked dinner.'),
  (35.7,  139.7, 'en', 'Working 14-hour days and still can''t afford rent.', 'Started journaling at night. Getting thoughts out of my head.'),
  (48.9,    2.3, 'en', 'Divorced. Kids live with their mom. The apartment feels empty.', null),
  (19.1,   72.9, 'en', 'My parents don''t accept who I am. I have to pretend every day.', 'Found an online support group. They understand.'),
  (-33.9,  18.4, 'en', 'Chronic pain nobody can see. Doctors say it''s in my head.', 'Meditation app. 10 minutes. Doesn''t fix it, but makes it bearable.'),
  (52.5,   13.4, 'en', 'Refugee. New language, new rules, old trauma.', null),
  (59.9,   30.3, 'ru', 'Не разговаривал ни с кем 3 недели. Забыл, как звучит мой голос.', 'Разговариваю с кошкой. Звучит глупо, но она слушает.'),
  (34.1, -118.2, 'en', 'Addicted. Clean for 47 days. Every day is a battle.', 'AA meetings every day. The people there saved my life.'),
  (1.3,   103.8, 'en', 'Everyone sees my success. Nobody sees my panic attacks at 3am.', 'Finally told one friend. Just one. It changed everything.')
) as seed(lat, lng, lang, text, coped)
where not exists (select 1 from public.stories);
