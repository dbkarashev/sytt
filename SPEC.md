# sytt — спецификация

## Концепция

Интерактивный 3D-глобус с анонимными историями людей, переживающих тяжелые времена. Каждая история — точка-искра на планете. Внутри планеты — дышащее в ритме 4-1-6 свечение.

**Источник вдохновения:** песня RAYE × Hans Zimmer — *«Click Clack Symphony»* (2026, альбом «This Music May Contain Hope»). Название проекта — из строки «She will save herself this time». Центральная цитата показывается в ManifestoOverlay открывается по клику на лого в шапке:

> «The cold never lasts, my darling. It just teaches the heart how to burn.»

---

## Стек

- **Next.js 16.2.3** (App Router, Turbopack default)
- **React 19.2.4** (`headers()` async, route-handler `context.params` is Promise)
- **TypeScript 5**, **Tailwind CSS 4** (`@theme` block, `@import "tailwindcss"`)
- **three** + **react-globe.gl 2.37** (wraps `three-globe` + `three`)
- **h3-js 4.4** для hex-cells (включая ручное покрытие Антарктики — см. ниже)
- **Supabase** (PostgreSQL + REST) с новой схемой ключей (`sb_publishable_…` / `sb_secret_…`) — хранилище и rate limit
- **Groq API** (Llama 3.3 70B Versatile) — модерация
- **Vercel** — деплой (free tier) + **`@vercel/speed-insights`** для real-user Core Web Vitals

Ключевые breaking changes в Next.js 16 vs ранних версий описаны в `node_modules/next/dist/docs/` — читать перед правками.

---

## Структура страниц

- `/` — главная: сразу глобус, без intro. Манифест открывается как overlay по клику на лого в шапке (не отдельный роут).
- `/api/stories` — GET all / POST create
- `/api/stories/[id]` — PATCH для редактирования своей истории (owner-check по `ip_hash`)
- `/api/me` — GET текущих координат по IP (для preview-искры на глобусе)
- `/api/keepalive` — GET, только для Vercel Cron: пинг Supabase

---

## Главный экран

### 1. Глобус (react-globe.gl + three.js scene injection)

Темный dotted globe на всю страницу. Реализация:

- `hexPolygonsData` с `hexPolygonUseDots=true`, `hexPolygonResolution=4`, цвет точек `#6B8A9E`.
- **Антарктика требует обхода**: h3 `polygonToCells` не умеет полигоны, пересекающие полюс. Antarctica из hex-слоя удалена (`hexLand = land.filter(f => NAME !== 'Antarctica')`). Вместо этого — `customLayerData` с `gridDisk(poleCell, 95)` + point-in-polygon по настоящему multiPolygon из GeoJSON. Материал `MeshLambertMaterial` — идентичный тому, что `three-globe` использует для hex dots, чтобы цвет совпадал под тем же освещением.
- Полупрозрачный `globeMaterial` (`MeshBasicMaterial` color `#0a1322` opacity 0.35) — делает «внутренность» планеты приглушенной, чтобы свечение просвечивало сквозь hex-точки.
- `showGraticules=true`, `showAtmosphere=false`.
- Auto-rotate через `controls().autoRotateSpeed=0.24`. Сброс при drag, возврат через 5s.
- Zoom limits: `minDistance=160`, `maxDistance=620`. Pinch и колесо через OrbitControls. Дополнительно на touch-устройствах реализован **double-tap-and-drag zoom** (поверх OrbitControls, экспоненциальная чувствительность) — см. `useEffect` в [components/GlobeView.tsx](components/GlobeView.tsx).
- Фон body — radial-gradient `--color-night-2` → `--color-night-1` → `--color-night-0`. На `html` выставлен однотонный `--color-night-0` + `overscroll-behavior-y: none` — чтобы iOS rubber-band и прозрачный URL-bar не показывали белый.

Файл: [components/Globe.tsx](components/Globe.tsx). GeoJSON-данные лежат в `public/countries.geojson` (копия из `three-globe/example/hexed-polygons`).

### 2. Дышащее ядро — shader fire + particles

Компонент [components/BreathingCore.tsx](components/BreathingCore.tsx). Вставляется в `globeRef.current.scene()`.

**Два shader-shell'а** (procedural fire через simplex-noise fbm):
- radius 0.17R и 0.10R (четверть диаметра планеты максимум)
- разные noise scales для глубины
- `NormalBlending` — Additive делает «солнце» вместо огня
- Цвета в shader: halo `#660F0A` → middle `#C76125` → core `#F2AD52`
- Дыхание через uniform `uBreath` (приходит из `breathAmount(performance.now())`)

**Particle system** (45 искр, additive с низким alpha):
- Vertex-шейдер: частицы летят от `0.12R` до `0.32R` по случайным направлениям за 2.5–5 сек
- Fragment: радиальный градиент `hot → cool`, fade в начале и в конце жизни
- Сильно приглушены (`vAlpha * 0.08`) чтобы не пересветить scene

**Ритм 4-1-6**: все управляется из [lib/breathing.ts](lib/breathing.ts):
- `BREATH.inhaleMs = 4000`
- `BREATH.holdMs = 1000`
- `BREATH.exhaleMs = 6000`
- `breathAmount(t)` → 0..1 с ease-in-out

`BreathIndicator` внизу экрана показывает тихий курсив *breathe in* / *breathe out* / пусто на hold.

### 3. Искры-истории

Компонент [components/StorySparks.tsx](components/StorySparks.tsx). Вставляется в scene как `THREE.Group` со `Sprite`-ами.

- Каждая история — `THREE.Sprite` с canvas-текстурой (radial gradient)
- Цвет зависит от `story.coped`: warm `#FFB060` если есть coped, dim `#FF9050` если еще в темноте
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

Компонент [components/StoryOverlay.tsx](components/StoryOverlay.tsx). Fade-in/out 500мс, bottomsheet на мобильных (`items-end`). Закрытие — **только** ESC, backdrop-click и кнопка × (44×44 tappable-зона для iOS). Клик по самому тексту истории намеренно не закрывает: либо раскрывает набор (во время typewriter), либо ничего не делает.

Текст истории, feeling и coped печатаются посимвольно в типографском темпе (base delay 32мс + пунктуация задерживает курсор). Клик по истории во время набора раскрывает ее целиком сразу.

Навигация между историями: стрелки по бокам (слева/справа, видны всегда, включая mobile), `ArrowLeft`/`ArrowRight` с клавиатуры, горизонтальный свайп на мобильных. Навигация выбирает следующую/предыдущую соседнюю историю в ту же сторону по проекции на 2D (не по id). Если расстояние > 500 км — глобус плавно панорамирует на новую точку. Клик на свою/чужую точку пока открыт другой overlay — корректно закрывает предыдущий (см. `closeOverlays()` в GlobeView).

### 5. UI overlay

**Шапка** ([components/Header.tsx](components/Header.tsx)):
- Слева: `save yourself this time` курсивом (тэглайн-лого, клик → ManifestoOverlay)

**Низ экрана:**
- `BreathIndicator` — показывается только после `ready=true` (чтобы «breathe in/out» не мерцал под скелетом загрузки)
- Добавление истории — клик по preview-искре на собственной позиции на глобусе (см. StorySparks)
- Справа внизу — кнопка `focus me` (иконка-прицел), центрирует глобус на твоих координатах

### 6. Добавление истории

Форма [components/AddStoryModal.tsx](components/AddStoryModal.tsx). Поля:

| Поле | Тип | Обязательное | Ограничения |
|------|-----|--------------|-------------|
| Текст истории | textarea | Да | 20–500 символов |
| Что чувствуешь (feeling) | textarea | Нет | до 300 |
| Что помогает (coped) | textarea | Нет | до 300. Только при редактировании своей истории — на создании не принимается, добавляется PATCH'ем позже |

Язык не выбирается — форма всегда шлет `lang: "en"`. БД-тип `Lang = "en" \| "ru"`, где `"ru"` покрывает только чтение legacy-записей с русским текстом.

**Координаты не вводятся вообще.** Сервер определяет по IP через `ipapi.co` (см. `lib/geolocate.ts`), округляет до 0.1°. При неудаче: dev → fallback Moscow `(55.8, 37.6)`, prod → 500 error.

Состояния формы:
- `idle` → обычная
- `submitting` → кнопка с `animate-breathing` (пульсация в ритме дыхания)
- `success` → `✦ Your story is on the map now.` на 1.8 сек, потом close
- `error` rejected → `We can't publish this exact wording. Try rephrasing.`
- `error` rate_limited → обычная подсказка подождать

---

## Дизайн

### Палитра (фиксирована в `@theme` в `app/globals.css`)

```
Фон:                 #070B14 → #0D1321 (radial gradient)
Земля (точки):       #6B8A9E
Искра «в темноте»:   #FF9050
Искра «держится»:    #FFB060
Свечение core:       #F2AD52
Свечение middle:     #C76125
Свечение halo:       #660F0A
Текст:               rgba(255,255,255,0.85)
```

### Шрифты

- Serif: **Lora**
- Sans: **Nunito**

Оба через `next/font/google` с `--font-lora` / `--font-nunito` CSS-переменными. Subsets: latin + cyrillic — cyrillic нужен для корректного отображения legacy-записей на русском.

### Дыхание UI (ритм 4-1-6)

Все живое в интерфейсе дышит одним ритмом:
- Shader fire внутри планеты
- Искры-истории (scale + opacity)
- `animate-breathing` для pulse (opacity 0.55 → 1 → 0.55)
- `animate-breathing-glow` для кнопок (opacity + box-shadow)
- BreathIndicator (текст фазы)
- Fade попапов — 500мс (дыхательный темп)

Резких анимаций нет. Все медленнее обычного.

---

## База данных (Supabase)

SQL-скрипт сохранен в [supabase-setup.sql](supabase-setup.sql). Выполнить в Supabase SQL Editor.

```sql
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
-- Миграция существующих таблиц (идемпотентно):
alter table public.stories add column if not exists feeling text;

create index if not exists idx_stories_location on public.stories (lat, lng);
create index if not exists idx_stories_created  on public.stories (created_at desc);
alter table public.stories enable row level security;
create policy "Anyone can read stories" on public.stories for select using (true);
-- INSERT/UPDATE только через server API с secret key, никаких write-policy.
```

Seed 12 начальных историй включен в тот же SQL-файл (идемпотентно).

**Схема ключей Supabase:**
- `sb_publishable_…` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (в коде не используется, зарезервировано под клиентскую читалку)
- `sb_secret_…` → `SUPABASE_SECRET_KEY` (все серверные записи и чтение идут через него)

Код читает [lib/supabase.ts](lib/supabase.ts) — прямой REST через `fetch` (не supabase-js, чтобы не раздувать бандл).

Fallback на in-memory `globalThis` store в dev без env — см. [lib/store.ts](lib/store.ts).

### API Routes

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/stories` | Все истории, `Cache-Control: s-maxage=60, stale-while-revalidate=300` |
| POST | `/api/stories` | Создать: `{text, feeling, lang}`. Координаты сервер считает по IP. Coped добавляется позже через PATCH |
| PATCH | `/api/stories/[id]` | Редактировать свою историю. Owner-check по `ip_hash` записи |
| GET | `/api/me` | Координаты клиента по его IP (для preview-искры на карте) |
| GET | `/api/keepalive` | Для Vercel Cron: читает Supabase. `{supabase: "ok"}`, 500 если запрос упал |

---

## Модерация

Два слоя: быстрый regex-фильтр и контекстная LLM-проверка. Стандартные moderation-классификаторы (OpenAI Moderation, Mistral, Perspective) не подошли — они false-positive блокируют выражение боли, что для платформы про людей в кризисе вредит пользователям. Нужно контекстное понимание, не классификатор.

**Слой 1 — Regex + stopwords** (моментально, 0 false positives для crisis):
- Длина 20–500
- ≥ 3 слов
- Нет URL, email, телефонов
- Нет 4+ одинаковых символов подряд
- Нет CAPS-only (>8 букв)
- Стопворды EN (мат, расизм, crypto spam, threats) — см. [lib/stopwords/en.ts](lib/stopwords/en.ts). RU-списка нет: UI английский, русские записи в БД только legacy и через форму не создаются.

**Слой 2 — Groq Llama 3.3 70B Versatile** с crisis-aware system prompt:

Модель различает выражение собственной боли (пропускается) и агрессию к другим, конкретные harm-инструкции, спам (блокируется). Точная формулировка системного промпта — в [lib/moderate.ts](lib/moderate.ts).

Возвращает `{"allow": bool, "reason": "<tag>"}`.

Таймаут 6 секунд, `response_format: json_object`, `temperature: 0.1`. Код: [lib/moderate.ts](lib/moderate.ts).

### Политика fail-closed

В `NODE_ENV=production`:
- Отсутствие `GROQ_API_KEY` → reject
- Сбой Groq (HTTP error, timeout, parse fail) → reject

В dev:
- Отсутствие `GROQ_API_KEY` → approve (skip)
- Сбой Groq → reject (чтобы заметить проблему)

---

## Rate limiting

**Prod: Postgres-функция в Supabase.** 3 submissions / 1h per IP hash. Код: [lib/ratelimit.ts](lib/ratelimit.ts), SQL: [supabase-setup.sql](supabase-setup.sql), раздел 5.

- `POST /api/stories` до модерации делает один RPC-вызов `rate_limit_hit(ip_hash, max, window_seconds)` через PostgREST с secret key. Функция под advisory lock по хэшу считает попытки за окно в таблице `rate_limit_hits`; если лимит не исчерпан — записывает попытку и возвращает `false`, иначе `true` без записи. Заодно удаляет строки старше суток.
- Попытка засчитывается **до** модерации, а не после insert'а. Это осознанно: иначе спамер мог бы бесконечно жечь Groq-запросы через moderation-rejects без последствий. В crisis-контексте Groq-промпт настроен пропускать боль, так что для легитимного пользователя 3 rejects подряд крайне маловероятны.
- Таблица под RLS без политик, с функции снят `execute` для `anon` и `authenticated` — publishable key к лимиту не подступится.
- **Fail-closed в prod**: отсутствие Supabase env / сбой RPC → 429.
- **Dev fallback**: без env → in-memory sliding window (симметрично с хранилищем и Groq).

Отдельного сервиса под rate limit нет намеренно: ещё один бесплатный внешний сервис — это ещё одна точка отказа, которую надо не дать заснуть, а при его пропаже прод из-за fail-closed молча отвечал бы 429 на все отправки. Каждая проверка лимита к тому же — ещё один запрос к базе, который Supabase засчитывает как активность.

---

## Геолокация

[lib/geolocate.ts](lib/geolocate.ts) — серверный lookup по IP через `ipapi.co/{ip}/json/`. Таймаут 2.5s. Фильтр приватных/localhost диапазонов.

В dev (где IP приватный) — fallback на Moscow `(55.8, 37.6)`, чтобы форма работала локально.

В prod при сбое — 500 с `reason: "geo_failed"`.

---

## i18n

UI только English. Копирайт лежит в [messages/en.json](messages/en.json) чтобы не был разбросан по компонентам. `useLang()` возвращает статически EN-бандл.

---

## SEO

- Title и description в `app/layout.tsx` (EN)
- OG-image динамическая: [app/opengraph-image.tsx](app/opengraph-image.tsx) (1200x630, gradient + искры + *«save yourself this time.»* курсивом)
- Favicon: [public/favicon.svg](public/favicon.svg) — глобус (круг, меридиан, экватор) без подложки, цвет штриха переключается через `prefers-color-scheme` внутри SVG; [app/favicon.ico](app/favicon.ico) — растровый fallback 48/32/16 в фиксированном `#a0a0a0`, отрендерен из SVG в Chromium

---

## Структура проекта

```
/app
  /page.tsx                  сразу GlobeView, без intro
  /api/stories/route.ts      GET/POST
  /api/stories/[id]/route.ts PATCH своей истории
  /api/me/route.ts           GET координат клиента по IP
  /api/keepalive/route.ts    GET для Vercel Cron — пинг Supabase
  /layout.tsx                шрифты, metadata, theme-color
  /opengraph-image.tsx       динамический OG
  /favicon.ico               ICO-fallback favicon (из public/favicon.svg)
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
  /ratelimit.ts              RPC в Postgres-функцию + in-memory fallback
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

supabase-setup.sql           SQL для инициализации БД
```

---

## Переменные окружения

```
# Supabase — хранилище историй
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # reserved, не используется в коде пока
SUPABASE_SECRET_KEY=sb_secret_...

# Groq — модерация через Llama 3.3 70B
GROQ_API_KEY=gsk_...

# Salt для SHA-256 IP-hash
IP_SALT=случайная-hex-строка

# Опционально, для absolute OG URLs
NEXT_PUBLIC_SITE_URL=https://sytt.vercel.app
```

---

## Статус

Проект задеплоен на Vercel, прод работает на `sytt.vercel.app`. Ветки: `main` — production (под branch protection, merge только через PR с rebase/linear history), `dev` — рабочая, preview-деплои на каждый push. Speed Insights подключены — данные по LCP/INP/CLS копятся.

Vercel Cron ([vercel.json](vercel.json)) шесть раз в сутки (каждые 4 часа) дёргает `/api/keepalive`, который читает Supabase — чтобы free tier не заснул от неактивности. Supabase паузит free-проект, если за неделю не набирается «нескольких запросов к базе в день»; одного пинга в сутки ему не хватает. Hobby-план Vercel разрешает одному cron-выражению срабатывать не чаще раза в день, поэтому в `vercel.json` шесть записей с разными часами. Роут объявлен `force-dynamic`, чтобы запрос не оседал в ISR-кэше и каждый вызов реально доходил до базы (у `/api/stories` стоит `revalidate = 60`, поэтому пинговать его ненадёжно). Крон запускается только на production-деплое, на preview не работает.

Готовы и отлажены: глобус с огненным ядром, искры с кастомным raycasting'ом, StoryOverlay с typewriter-подачей и навигацией (клавиши/свайп/стрелки), AddStoryModal создания и редактирования, IP-геолокация через ipapi.co, crisis-aware модерация через Groq, Supabase-хранилище с новыми sb-ключами, rate limit в Postgres-функции (3/час на IP-hash) с fail-closed в prod и in-memory fallback в dev.

Актуальные ограничения:
- Нет мониторинга ошибок. Sentry или аналог можно добавить перед серьезным трафиком.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` лежит в env, но код его не использует (все серверные запросы через secret key). Можно не выставлять — оставлен как задел если появится клиентская читалка.

---

## Вне объема проекта

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

> «Помогает ли это человеку?»
