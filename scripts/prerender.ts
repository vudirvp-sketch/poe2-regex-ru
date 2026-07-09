/**
 * Prerender script — generates route-specific HTML files for SEO.
 *
 * After `vite build`, this script:
 * 1. Reads dist/index.html
 * 2. For each route, creates dist/{route}/index.html with:
 *    - Route-specific <title> and meta tags (description, og:*, twitter:*, canonical)
 *    - <noscript> fallback content with navigation links + route description
 * 3. GitHub Pages serves these files directly → search engines see route-specific content
 *
 * No browser/Puppeteer needed — pure string manipulation on the built HTML.
 * React still hydrates the page for interactivity.
 *
 * Usage: tsx scripts/prerender.ts
 * (automatically called via `pnpm build`)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = 'https://vudirvp-sketch.github.io/poe2-regex-ru';

interface RouteMeta {
  path: string;
  title: string;
  description: string;
  noscriptIntro: string;
}

const routes: RouteMeta[] = [
  {
    path: '/',
    // iter 180: title shortened 80→58 chars, keyword forward («Path of Exile 2» в начале).
    // Was: 'PoE2 Regex — Регексы и фильтрация предметов для Path of Exile 2 (русский клиент)' (80 chars).
    title: 'Генератор regex для Path of Exile 2 (PoE2) — русский клиент',
    description: 'Генератор регексов и поисковых строк для фильтра предметов Path of Exile 2 на русском языке. Путевые камни, башни предтеч, реликвии, самоцветы, пояса, кольца, амулеты, торговец. Лут-фильтр, аффиксы и моды, ёфикация, лимит 250 символов.',
    noscriptIntro: 'Генератор регексов для фильтра предметов Path of Exile 2 на русском языке. Создавайте поисковые строки для путевых камней, реликвий, самоцветов, колец, амулетов и других категорий.',
  },
  {
    path: '/waystone',
    title: 'Путевые камни PoE2 — Генератор регексов | PoE2 Regex',
    description: 'Генератор поисковых строк для фильтрации путевых камней Path of Exile 2 на русском языке. Аффиксы карт, осквернённые и очернённые путевые камни, числовые диапазоны.',
    noscriptIntro: 'Фильтрация путевых камней Path of Exile 2. Выберите нужные аффиксы, укажите числовые диапазоны — генератор создаст компактную поисковую строку для игры.',
  },
  {
    path: '/tablet',
    // iter 181: renamed «Башни предтеч» → «Плитки предтеч» (user feedback).
    title: 'Плитки предтеч PoE2 — Генератор регексов | PoE2 Regex',
    description: 'Генератор поисковых строк для плиток предтеч Path of Exile 2 на русском языке. Ритуал, бездна, делириум, ваал, экспедиция — фильтрация аффиксов плиток.',
    noscriptIntro: 'Фильтрация плиток предтеч Path of Exile 2. Ритуал, бездна, делириум, ваал, экспедиция — выберите нужные свойства и скопируйте поисковую строку.',
  },
  {
    path: '/relic',
    title: 'Реликвии PoE2 — Генератор регексов | PoE2 Regex',
    description: 'Генератор поисковых строк для фильтрации реликвий Path of Exile 2 на русском языке. Префиксы и суффиксы реликвий, числовые диапазоны.',
    noscriptIntro: 'Фильтрация реликвий Path of Exile 2. Выберите нужные префиксы и суффиксы — генератор создаст поисковую строку для игры.',
  },
  {
    path: '/jewel',
    title: 'Самоцветы PoE2 — Генератор регексов | PoE2 Regex',
    description: 'Генератор поисковых строк для фильтрации самоцветов Path of Exile 2 на русском языке. Рубин, изумруд, сапфир, осквернённые и очернённые самоцветы.',
    noscriptIntro: 'Фильтрация самоцветов Path of Exile 2. Рубин, изумруд, сапфир — выберите свойства и скопируйте поисковую строку.',
  },
  {
    // iter 178: SEO entry for /timeless-jewel. Atlas-tree search uses
    // OR-only regex — separate from /jewel (which uses item-semantic
    // regex with AND/NOT). See docs/ATLAS_JEWEL_PLAN.md.
    path: '/timeless-jewel',
    title: 'Вневременные самоцветы PoE2 — Генератор регексов для древа атласа | PoE2 Regex',
    description: 'Генератор поисковых строк для вневременных самоцветов Path of Exile 2 (Вечная ненависть, Трагедия героев). Подсветка нод древа атласа через OR-регекс. 75 пассивных нод, поиск по названию и эффекту.',
    noscriptIntro: 'Вневременные самоцветы Path of Exile 2 — Вечная ненависть и Трагедия героев. Выберите пассивные ноды древа атласа для подсветки — генератор создаст OR-регекс для поиска в игре.',
  },
  {
    path: '/vendor',
    title: 'Торговец PoE2 — Генератор поисковых строк | PoE2 Regex',
    description: 'Генератор поисковых строк для фильтрации товаров торговца Path of Exile 2 на русском языке. Свойства и цены товаров торговца.',
    noscriptIntro: 'Фильтрация товаров торговца Path of Exile 2. Выберите нужные свойства и пороговые значения — скопируйте поисковую строку.',
  },
  {
    path: '/belt',
    title: 'Пояса PoE2 — Генератор регексов | PoE2 Regex',
    description: 'Генератор поисковых строк для фильтрации поясов Path of Exile 2 на русском языке. Атакующие, защитные и универсальные свойства поясов.',
    noscriptIntro: 'Фильтрация поясов Path of Exile 2. Атакующие, защитные и универсальные свойства — выберите нужные аффиксы.',
  },
  {
    path: '/ring',
    title: 'Кольца PoE2 — Генератор регексов | PoE2 Regex',
    description: 'Генератор поисковых строк для фильтрации колец Path of Exile 2 на русском языке. Аффиксы колец всех типов и источников, числовые диапазоны.',
    noscriptIntro: 'Фильтрация колец Path of Exile 2. Выберите нужные аффиксы и числовые диапазоны — скопируйте поисковую строку.',
  },
  {
    path: '/amulet',
    title: 'Амулеты PoE2 — Генератор регексов | PoE2 Regex',
    description: 'Генератор поисковых строк для фильтрации амулетов Path of Exile 2 на русском языке. Полное покрытие префиксов и суффиксов амулетов.',
    noscriptIntro: 'Фильтрация амулетов Path of Exile 2. Префиксы и суффиксы — выберите нужные аффиксы и скопируйте поисковую строку.',
  },
];

const navLinks = [
  { path: '/', label: 'Главная' },
  { path: '/waystone', label: 'Путевые камни' },
  { path: '/tablet', label: 'Плитки предтеч' },
  { path: '/relic', label: 'Реликвии' },
  { path: '/jewel', label: 'Самоцветы' },
  { path: '/timeless-jewel', label: 'Вневременные самоцветы' },
  { path: '/vendor', label: 'Торговец' },
  { path: '/belt', label: 'Пояса' },
  { path: '/ring', label: 'Кольца' },
  { path: '/amulet', label: 'Амулеты' },
];

function buildNoscriptContent(route: RouteMeta): string {
  const links = navLinks
    .map(l => `<a href="${BASE_URL}${l.path}">${l.label}</a>`)
    .join(' | ');
  return `<noscript><div style="padding:1rem;font-family:system-ui,sans-serif;color:#e0e0e0;background:#0f0f1a;max-width:800px;margin:0 auto"><h1 style="color:#c89b3c;font-size:1.5rem;margin-bottom:0.5rem">${route.title.replace(/ &mdash; /g, ' — ')}</h1><p style="margin-bottom:1rem;line-height:1.6">${route.noscriptIntro}</p><nav style="margin-bottom:1rem;font-size:0.9rem">${links}</nav><p style="font-size:0.85rem;color:#888">Для полноценной работы приложения требуется JavaScript. Включите JavaScript в браузере.</p></div></noscript>`;
}

function replaceTag(html: string, pattern: RegExp, replacement: string): string {
  return html.replace(pattern, replacement);
}

function generateRouteHtml(baseHtml: string, route: RouteMeta): string {
  let html = baseHtml;
  const fullUrl = `${BASE_URL}${route.path}`;

  // Replace <title>
  html = replaceTag(
    html,
    /<title>.*?<\/title>/,
    `<title>${route.title}</title>`
  );

  // Replace meta description
  html = replaceTag(
    html,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${route.description}" />`
  );

  // Replace og:title
  html = replaceTag(
    html,
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${route.title}" />`
  );

  // Replace og:description
  html = replaceTag(
    html,
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${route.description}" />`
  );

  // Replace og:url
  html = replaceTag(
    html,
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:url" content="${fullUrl}" />`
  );

  // Replace twitter:title
  html = replaceTag(
    html,
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${route.title}" />`
  );

  // Replace twitter:description
  html = replaceTag(
    html,
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${route.description}" />`
  );

  // Replace canonical
  html = replaceTag(
    html,
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${fullUrl}" />`
  );

  // Replace og:image alt
  html = replaceTag(
    html,
    /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:image:alt" content="${route.title}" />`
  );

  // Add noscript fallback content before </body>
  const noscript = buildNoscriptContent(route);
  html = html.replace('</body>', `${noscript}\n  </body>`);

  return html;
}

// --- Main ---
const distDir = resolve(process.cwd(), 'dist');
const indexPath = resolve(distDir, 'index.html');

if (!existsSync(indexPath)) {
  console.error('[prerender] dist/index.html not found. Run `vite build` first.');
  process.exit(1);
}

console.log('[prerender] Reading dist/index.html...');
const baseHtml = readFileSync(indexPath, 'utf-8');

let generated = 0;

for (const route of routes) {
  const routeHtml = generateRouteHtml(baseHtml, route);

  if (route.path === '/') {
    // Overwrite dist/index.html with updated version (adds noscript)
    writeFileSync(indexPath, routeHtml, 'utf-8');
    console.log(`[prerender] Updated dist/index.html (home + noscript)`);
  } else {
    const routeDir = resolve(distDir, route.path.slice(1));
    mkdirSync(routeDir, { recursive: true });
    writeFileSync(resolve(routeDir, 'index.html'), routeHtml, 'utf-8');
    console.log(`[prerender] Generated dist${route.path}/index.html`);
  }
  generated++;
}

console.log(`[prerender] Done: ${generated} route-specific HTML files generated.`);
