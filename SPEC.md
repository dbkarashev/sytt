# sytt — актуальное ТЗ

> Это пересборка оригинального ТЗ на **апрель 2026** с учётом того, что изменилось в реальности: мёртвые API, новые схемы ключей, актуальные библиотеки. Оригинальный ТЗ устарел в деталях (Perspective API, старые Supabase-ключи) — здесь источник истины. На него ссылайся в дальнейших сессиях.

---

## Концепция

Интерактивный 3D-глобус с анонимными историями людей, переживающих тяжёлые времена. Каждая история — точка-искра на планете. Внутри планеты — дышащее в ритме 4-1-6 свечение.

Это **не доска жалоб и не группа поддержки**. Это место, куда человек приходит почувствовать: я не один.

Главная идея: **«Save yourself this time»** — «сохрани себя, продержись». План-минимум.

Только English. Тон — тихий, честный, без фальшивого оптимизма.

**Источник вдохновения:** песня RAYE × Hans Zimmer — *«Click Clack Symphony»* (2026, альбом «This Music May Contain Hope»). Ключевая строка, откуда и название проекта: «She will save herself this time». Центральная цитата в `/about`:

> «The cold never lasts, my darling. It just teaches the heart how to burn.»

Мысль, которую проект несёт — не «ты должен победить», а «сегодня ничего не должно измениться, достаточно остаться».

---

## Стек (актуальные версии)

- **Next.js 16.2.3** (App Router, Turbopack default)
- **React 19.2.4** (`headers()` async, route-handler `context.params` is Promise)
- **TypeScript 5**, **Tailwind CSS 4** (`@theme` block, `@import "tailwindcss"`)
- **three** + **react-globe.gl 2.37** (wraps `three-globe` + `three`)
- **h3-js 4.4** для hex-cells (включая ручное покрытие Антарктики — см. ниже)
- **Supabase** (PostgreSQL + REST) с новой схемой ключей (`sb_publishable_…` / `sb_secret_…`)
- **Groq API** (Llama 3.3 70B Versatile) — модерация
- **Vercel** — деплой (free tier)

Ключевые breaking changes в Next.js 16 vs ранних версий описаны в `node_modules/next/dist/docs/` — читать перед правками.

---

## Структура страниц

- `/` — главная: сразу глобус, без intro. Манифест открывается как overlay по клику на лого в шапке (не отдельный роут).
- `/api/stories` — GET all / POST create
- `/api/stories/[id]` — PATCH для редактирования своей истории (owner-check по `ip_hash`)
- `/api/me` — GET текущих координат по IP (для preview-искры на глобусе)

---

## Главный экран

### 1. Глобус (react-globe.gl + three.js scene injection)

Без прелюдии — при открытии сайта человек сразу видит дышащую планету. Intro была убрана: в кризисе никому не нужен кинематографичный wrapper, нужно сразу место.

Тёмный dotted globe на всю страницу. Реализация:

- `hexPolygonsData` с `hexPolygonUseDots=true`, `hexPolygonResolution=4`, цвет точек `#6B8A9E`.
- **Антарктика требует обхода**: h3 `polygonToCells` не умеет полигоны, пересекающие полюс. Antarctica из hex-слоя удалена (`hexLand = land.filter(f => NAME !== 'Antarctica')`). Вместо этого — `customLayerData` с `gridDisk(poleCell, 95)` + point-in-polygon по настоящему multiPolygon из GeoJSON. Материал `MeshLambertMaterial` — идентичный тому, что `three-globe` использует для hex dots, чтобы цвет совпадал под тем же освещением.
- Полупрозрачный `globeMaterial` (`MeshBasicMaterial` color `#0a1322` opacity 0.35) — делает «внутренность» планеты приглушённой, чтобы свечение просвечивало сквозь hex-точки.
- `showGraticules=true`, `showAtmosphere=false`.
- Auto-rotate через `controls().autoRotateSpeed=0.24`. Сброс при drag, возврат через 5s.
- Zoom limits: `minDistance=160`, `maxDistance=620`.
- Фон body — radial-gradient `--color-night-2` → `--color-night-1` → `--color-night-0`.

Файл: [components/Globe.tsx](components/Globe.tsx). GeoJSON-данные лежат в `public/countries.geojson` (копия из `three-globe/example/hexed-polygons`).

### 2. Дышащее ядро — shader fire + particles

Компонент [components/BreathingCore.tsx](components/BreathingCore.tsx). Вставляется в `globeRef.current.scene()`.

**Два shader-shell'а** (procedural fire через simplex-noise fbm):
- radius 0.17R и 0.10R (четверть диаметра планеты макс. — по ТЗ)
- разные noise scales для глубины
- `NormalBlending` (не Additive — Additive давал «солнце» вместо огня)
- Цвета в shader: halo `#660F0A` → middle `#C76125` → core `#F2AD52`
- Дыхание через uniform `uBreath` (приходит из `breathAmount(performance.now())`)

**Particle system** (45 искр, additive с низким alpha):
- Vertex-шейдер: частицы летят от `0.12R` до `0.32R` по случайным направлениям за 2.5–5 сек
- Fragment: радиальный градиент `hot → cool`, fade в начале и в конце жизни
- Сильно приглушены (`vAlpha * 0.08`) чтобы не пересветить scene

**Ритм 4-1-6**: всё управляется из [lib/breathing.ts](lib/breathing.ts):
- `BREATH.inhaleMs = 4000`
- `BREATH.holdMs = 1000`
- `BREATH.exhaleMs = 6000`
- `breathAmount(t)` → 0..1 с ease-in-out

`BreathIndicator` внизу экрана показывает тихий курсив *breathe in* / *breathe out* / пусто на hold.

### 3. Искры-истории

Компонент [components/StorySparks.tsx](components/StorySparks.tsx). Вставляется в scene как `THREE.Group` со `Sprite`-ами.

- Каждая история — `THREE.Sprite` с canvas-текстурой (radial gradient)
- Цвет зависит от `story.coped`: warm `#FFB060` если есть coped, dim `#FF9050` если ещё в темноте
- Положение: конвертация lat/lng в 3D через `react-globe.gl`-совместимую формулу (x=cos(lat)sin(lng), y=sin(lat), z=cos(lat)cos(lng)) на радиусе `globeR + 0.8`
- Flicker через сумму двух синусов с фазовым offset'ом (псевдослучайный phase для каждой искры)
- Pulse по `breathAmount`
- LOD: `lodVisible(index, altitude)` — при zoom-out показывает subset детерминированно

**Клик реализован вручную, не через встроенный raycasting** (стандартный `raycaster.intersectObjects(sprites)` плохо работает для маленьких Sprite'ов в three-globe scene):

```
camera.updateMatrixWorld(true);  // критично: иначе проекция из stale-матрицы
const nearSide = pos.x*camPos.x + pos.y*camPos.y + pos.z*camPos.z;
if (nearSide <= 0) skip;  // back-side cull
const projected = pos.project(camera);
// dist в NDC ± ndcTolerance
```

Hit → `onSelect(story)` → StoryOverlay.

### 4. StoryOverlay (попап истории)

Компонент [components/StoryOverlay.tsx](components/StoryOverlay.tsx). Fade-in/out 500мс, bottomsheet на мобильных (`items-end`). Закрытие по ESC, backdrop-click, кнопке ×.

Текст истории, feeling и coped печатаются посимвольно в типографском темпе (base delay 32мс + пунктуация задерживает курсор). Клик по истории во время набора раскрывает её целиком сразу.

Навигация между историями: стрелки по бокам (слева/справа, видны всегда), `ArrowLeft`/`ArrowRight` с клавиатуры, горизонтальный свайп на мобильных. Навигация выбирает следующую/предыдущую соседнюю историю в ту же сторону по проекции на 2D (не по id). Если расстояние > 500 км — глобус плавно панорамирует на новую точку.

### 5. UI overlay

**Шапка** ([components/Header.tsx](components/Header.tsx)):
- Слева: `save yourself this time` курсивом (тэглайн-лого, клик → ManifestoOverlay)

**Низ экрана:**
- Кнопка «✦ Tell your story» с `animate-breathing-glow`
- `BreathIndicator`
- Подсказка управления — две версии через Tailwind 4 `pointer-coarse:`:
  - Desktop: `drag · scroll to zoom · click a spark`
  - Touch: `swipe · pinch to zoom · tap a spark`
- Счётчик stories / getting through

### 6. Добавление истории

Форма [components/AddStoryModal.tsx](components/AddStoryModal.tsx). Поля:

| Поле | Тип | Обязательное | Ограничения |
|------|-----|--------------|-------------|
| Текст истории | textarea | Да | 20–500 символов |
| Что помогает | textarea | Нет | до 300 |

Язык не выбирается — форма всегда шлёт `lang: "en"`. БД-тип `Lang = "en" \| "ru"` оставлен для совместимости со старыми записями.

**Координаты не вводятся вообще.** Сервер определяет по IP через `ipapi.co` (см. `lib/geolocate.ts`), округляет до 0.1°. При неудаче: dev → fallback Moscow `(55.8, 37.6)`, prod → 500 error.

Состояния формы:
- `idle` → обычная
- `submitting` → кнопка с `animate-breathing` (пульсация в ритме дыхания вместо слова «Checking…» — визуально чище)
- `success` → `✦ Your story is on the map now.` на 1.8 сек, потом close
- `error` rejected → `We can't publish this exact wording. Try rephrasing.`
- `error` rate_limited → обычная подсказка подождать

---

## Дизайн

### Атмосфера

3 часа ночи, ты не можешь уснуть, открываешь ноутбук — и видишь, что ты не один. Тихо, темно, но не мертво.

### Палитра (фиксирована в `@theme` в `app/globals.css`)

```
Фон:                 #070B14 → #0D1321 (radial gradient)
Земля (точки):       #6B8A9E
Искра «в темноте»:   #FF9050
Искра «держится»:    #FFB060
Свечение core:       #F2AD52 (после refactor на shader — чуть темнее чем ТЗ #FFD480, чтобы не «солнцем» светило)
Свечение middle:     #C76125
Свечение halo:       #660F0A
Текст:               rgba(255,255,255,0.85)
```

### Шрифты

- Serif: **Lora**
- Sans: **Nunito**

Оба через `next/font/google` с `--font-lora` / `--font-nunito` CSS-переменными (subsets: latin + cyrillic — cyrillic оставлен на случай если в БД есть старые русские истории, отображение корректно).

### Дыхание UI (ритм 4-1-6)

Всё живое в интерфейсе дышит одним ритмом:
- Shader fire внутри планеты
- Искры-истории (scale + opacity)
- `animate-breathing` для pulse (opacity 0.55 → 1 → 0.55)
- `animate-breathing-glow` для кнопок (opacity + box-shadow)
- BreathIndicator (текст фазы)
- Fade попапов — 500мс (дыхательный темп)

Резких анимаций нет. Всё медленнее обычного.

---

## База данных (Supabase)

SQL-скрипт сохранён в [supabase-setup.sql](supabase-setup.sql). Выполнить в Supabase SQL Editor.

```sql
create table if not exists public.stories (
  id uuid default gen_random_uuid() primary key,
  lat decimal(5,1) not null,
  lng decimal(5,1) not null,
  text text not null,
  coped text,
  lang varchar(2) default 'en',
  created_at timestamptz default now(),
  ip_hash varchar(64)
);
create index if not exists idx_stories_location on public.stories (lat, lng);
create index if not exists idx_stories_created  on public.stories (created_at desc);
alter table public.stories enable row level security;
create policy "Anyone can read stories" on public.stories for select using (true);
-- INSERT только через server API с secret key, никаких INSERT policy.
```

Seed 12 начальных историй включён в тот же SQL-файл (идемпотентно).

**Новая схема ключей (Supabase обновила API keys в 2025):**
- `sb_publishable_…` заменяет `anon` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (не используется в коде пока, зарезервировано)
- `sb_secret_…` заменяет `service_role` → `SUPABASE_SECRET_KEY` (все серверные записи)

Код читает [lib/supabase.ts](lib/supabase.ts) — прямой REST через `fetch` (не supabase-js, чтобы не раздувать бандл).

Fallback на in-memory `globalThis` store в dev без env — см. [lib/store.ts](lib/store.ts).

### API Routes

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/stories` | Все истории, `Cache-Control: s-maxage=60, stale-while-revalidate=300` |
| POST | `/api/stories` | Создать: `{text, feeling, lang}`. Координаты сервер считает по IP. Coped добавляется позже через PATCH |
| PATCH | `/api/stories/[id]` | Редактировать свою историю. Owner-check по `ip_hash` записи |
| GET | `/api/me` | Координаты клиента по его IP (для preview-искры на карте) |

---

## Модерация (**новая архитектура 2026**)

Оригинальный ТЗ предлагал 3 слоя: Regex + OpenAI Moderation + Google Perspective API.

**Реальность апреля 2026:**
- Perspective API **закрывается к концу 2026**, новые заявки не принимаются с февраля 2026 → удалён
- Стандартные moderation-классификаторы (OpenAI, Mistral, Perspective) системно **false-positive блокируют выражение боли** — на платформе для людей в кризисе это вредит пользователям
- Нужно **контекстное понимание**, не классификатор

### Архитектура — 2 слоя

**Слой 1 — Regex + stopwords** (моментально, 0 false positives для crisis):
- Длина 20–500
- ≥ 3 слов
- Нет URL, email, телефонов
- Нет 4+ одинаковых символов подряд
- Нет CAPS-only (>8 букв)
- Стопворды EN + RU (мат, расизм, crypto spam, threats) — см. [lib/stopwords/](lib/stopwords/)

**Слой 2 — Groq Llama 3.3 70B Versatile** с crisis-aware system prompt:

Модель получает инструкцию:
- **ALWAYS ALLOW**: боль, отчаяние, истощение, «I want to die» как описание состояния (не план), описания психических расстройств, потерь, одиночества
- **BLOCK**: атаки/слурсы/угрозы **к другим людям**, призывы к насилию, явные инструкции self-harm (не «хочу», а «вот как»), спам/крипта/реклама, троллинг

Модель возвращает `{"allow": bool, "reason": "<tag>"}`.

Таймаут 6 секунд, `response_format: json_object`, `temperature: 0.1`. Код: [lib/moderate.ts](lib/moderate.ts).

### Политика fail-closed

В `NODE_ENV=production`:
- Отсутствие `GROQ_API_KEY` → reject
- Сбой Groq (HTTP error, timeout, parse fail) → reject

В dev:
- Отсутствие `GROQ_API_KEY` → approve (skip)
- Сбой Groq → reject (чтобы заметить проблему)

### Обоснование ухода от OpenAI

OpenAI Moderation работает, но:
- Дублирует Groq-слой по функциям
- Классификатор не понимает «страдающий» vs «агрессор» так же хорошо как LLM с промптом
- Требует привязанной карты (OpenAI 2024+ не даёт 200 без payment method даже для free moderation)

$5 депозит на OpenAI, сделанный до решения об уходе, остаётся на аккаунте — не списывается пока не используются платные API. Ключ удалён из `.env.local` и `.env.example`.

---

## Rate limiting

**Prod: Upstash Redis через Vercel Marketplace.** `@upstash/ratelimit` sliding window — 3 submissions / 1h per IP hash. Код: [lib/ratelimit.ts](lib/ratelimit.ts).

- Env: `KV_REST_API_URL` / `KV_REST_API_TOKEN` (legacy KV-имена; `Redis.fromEnv()` подхватывает их через встроенный fallback с `UPSTASH_REDIS_REST_*`). Vercel Storage integration проставляет сам — Custom Prefix оставлять пустым. Для локалки — скопировать эти две переменные из Vercel.
- Counter увеличивается на **каждую попытку**, не только на успешный insert. Это осознанно: иначе спамер мог бы бесконечно жечь Groq-запросы через moderation-rejects без последствий. В crisis-контексте Groq-промпт настроен пропускать боль, так что для легитимного пользователя 3 rejects подряд крайне маловероятны.
- Prefix ключей: `sytt:rl:*`. `analytics: true` — rate-limit события видны в UI Upstash.
- **Fail-closed в prod**: отсутствие env / сбой Redis → 429.
- **Dev fallback**: без env → in-memory sliding window (симметрично с Supabase/Groq).

Почему не Supabase-таблица: проверка ПОСЛЕ insert'а не работает — модерация уже сожгла Groq-запрос до того, как unique-constraint сработал бы. Upstash — чекер ДО moderation.

---

## Геолокация

[lib/geolocate.ts](lib/geolocate.ts) — серверный lookup по IP через `ipapi.co/{ip}/json/`. Таймаут 2.5s. Фильтр приватных/localhost диапазонов.

В dev (где IP приватный) — fallback на Moscow `(55.8, 37.6)`, чтобы форма работала локально.

В prod при сбое — 500 с `reason: "geo_failed"`.

---

## i18n

Не локализовано. UI только English. JSON [messages/en.json](messages/en.json) вынесен чтобы копирайт не был разбросан по компонентам. `useLang()` возвращает статически EN-бандл — оставлен как hook для совместимости с существующими компонентами.

---

## SEO

- Title и description в `app/layout.tsx` (EN)
- OG-image динамическая: [app/opengraph-image.tsx](app/opengraph-image.tsx) (1200x630, gradient + искры + *«Save yourself this time.»* курсивом)
- Favicon: [public/favicon.svg](public/favicon.svg) — тёплый огонёк на `#070b14`

---

## Структура проекта

```
/app
  /page.tsx                  сразу GlobeView, без intro
  /api/stories/route.ts      GET/POST
  /api/stories/[id]/route.ts PATCH своей истории
  /api/me/route.ts           GET координат клиента по IP
  /layout.tsx                шрифты, metadata, theme-color
  /opengraph-image.tsx       динамический OG
  /globals.css               @theme + breathing keyframes + html fix для iOS

/components
  /Globe.tsx                 react-globe.gl + polar cap custom layer
  /GlobeSkeleton.tsx         SVG-индикатор загрузки до готовности глобуса
  /BreathingCore.tsx         shader fire + particles
  /BreathIndicator.tsx       «breathe in/out» текст
  /GlobeView.tsx             компоновщик: globe + core + sparks + overlay + modal
  /StorySparks.tsx           Sprite'ы + custom raycasting + preview-искра
  /StoryOverlay.tsx          попап истории с typewriter-подачей и навигацией
  /AddStoryModal.tsx         форма создания/редактирования своей истории
  /Header.tsx                лого-тэглайн, клик открывает ManifestoOverlay
  /ManifestoOverlay.tsx      манифест + цитата Raye

/lib
  /breathing.ts              4-1-6 цикл
  /geolocate.ts              IP → lat/lng
  /i18n.ts                   статический EN bundle
  /ip.ts                     IP из headers + hash
  /moderate.ts               Regex + Groq
  /ratelimit.ts              Upstash Redis sliding window + in-memory fallback
  /seed.ts                   12 историй (fallback, если Supabase не сконфигурирован)
  /store.ts                  in-memory fallback для историй (dev-only)
  /stopwords/en.ts
  /supabase.ts               REST client
  /types.ts                  Lang, Story

/messages
  /en.json

/public
  /countries.geojson         Natural Earth 110m
  /favicon.svg
  /favicon.ico

supabase-setup.sql           SQL для инициализации БД
```

---

## Переменные окружения

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # reserved, не используется в коде пока
SUPABASE_SECRET_KEY=sb_secret_...

# Groq moderation
GROQ_API_KEY=gsk_...

# Salt для SHA-256 IP-hash
IP_SALT=любая-случайная-строка

# Опционально, для absolute OG URLs
NEXT_PUBLIC_SITE_URL=https://...
```

---

## Статус (на 18 апреля 2026)

Проект задеплоен на Vercel, прод работает на `sytt.vercel.app`. Ветки: `main` — production, `dev` — рабочая, preview-деплои на каждый push.

Готовы и отлажены: глобус с огненным ядром, искры с кастомным raycasting'ом, StoryOverlay с typewriter-подачей и навигацией (клавиши/свайп/стрелки), AddStoryModal создания и редактирования, IP-геолокация через ipapi.co, crisis-aware модерация через Groq, Supabase-хранилище с новыми sb-ключами, Upstash Redis rate limit (3/час на IP-hash) с fail-closed в prod и in-memory fallback в dev.

Актуальные ограничения:
- Нет мониторинга ошибок. Sentry или аналог можно добавить перед серьёзным трафиком.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` лежит в env, но код его не использует (все серверные запросы через secret key). Можно не выставлять — оставлен как задел если появится клиентская читалка.

---

## Что НЕ делаем (на первой версии)

- Авторизация, аккаунты
- Комментарии к историям
- Лайки, реакции
- Админ-панель (модерация автоматическая)
- Перевод историй между языками
- PWA, уведомления
- Звук

---

## Финальная нота

Проект про человека, которому сейчас плохо. Каждое решение — от палитры до длительности анимации — проверяется вопросом:

> «Помогает ли это человеку, который открыл сайт в 3 ночи и не знает что делать?»

Ритм 4-1-6 — основа всего. Если что-то двигается быстрее — сбивает дыхание. Если медленнее — успокаивает.

Save yourself this time.
