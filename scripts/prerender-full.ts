/**
 * prerender-full.ts — Playwright-based full pre-rendering for SEO.
 *
 * After `vite build` and `tsx scripts/prerender.ts`, this script enhances
 * the route-specific HTML files with fully rendered React content.
 *
 * What it does:
 * 1. Starts a static HTTP server serving the dist/ directory
 * 2. Uses Playwright (headless Chromium) to navigate to each route
 * 3. Waits for React to mount and data to load
 * 4. Extracts the rendered HTML from #root
 * 5. Injects it into the route-specific HTML files
 *
 * Search engines that don't execute JavaScript will see the full content
 * (affix lists, numbers, navigation) instead of just meta tags + noscript.
 * When React mounts in the browser, it replaces the pre-rendered content.
 *
 * Requirements: playwright package + Chromium browser
 * Install: pnpm add -D playwright && npx playwright install chromium
 *
 * Usage: tsx scripts/prerender-full.ts
 * (called via `pnpm build:full` in CI, or `pnpm prerender:full` manually)
 *
 * If Playwright is not installed, the script exits gracefully with code 0
 * and the shell-based prerender (prerender.ts) is used instead.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, symlinkSync, statSync } from 'fs';
import { resolve, join, extname } from 'path';
import { createServer, type Server } from 'http';

const PORT = 8765;
const APP_BASE = '/poe2-regex-ru';

const routes = [
  '/',
  '/waystone',
  '/tablet',
  '/relic',
  '/jewel',
  '/vendor',
  '/belt',
  '/ring',
  '/amulet',
];

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

/**
 * Start a minimal static HTTP server.
 * Serves files from rootDir at http://localhost:PORT
 * Handles directory paths by serving index.html.
 */
function startServer(rootDir: string): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0].split('#')[0];
      let filePath = join(rootDir, urlPath);

      try {
        if (statSync(filePath).isDirectory()) {
          filePath = join(filePath, 'index.html');
        }
      } catch {
        // Path doesn't exist as file or directory — try index.html
        filePath = join(filePath, 'index.html');
      }

      try {
        const content = readFileSync(filePath);
        const ext = extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    });

    server.listen(PORT, () => {
      console.log(`[prerender-full] Static server: http://localhost:${PORT}`);
      resolve(server);
    });

    server.on('error', reject);
  });
}

async function main() {
  // Dynamic import of Playwright — graceful if not installed
  let chromium: any;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch {
    console.warn('[prerender-full] Playwright not installed. Skipping full prerender.');
    console.warn('[prerender-full] To enable: pnpm add -D playwright && npx playwright install chromium');
    process.exit(0);
  }

  const distDir = resolve(process.cwd(), 'dist');
  if (!existsSync(distDir)) {
    console.error('[prerender-full] dist/ not found. Run `vite build` first.');
    process.exit(1);
  }

  // Set up serve directory with correct path structure.
  // Vite builds with base=/poe2-regex-ru/, so assets reference /poe2-regex-ru/...
  // We need: http://localhost:PORT/poe2-regex-ru/ → dist/
  const serveDir = resolve('/tmp', `prerender-serve-${process.pid}`);
  mkdirSync(serveDir, { recursive: true });
  const linkPath = join(serveDir, 'poe2-regex-ru');

  // Create symlink (junction for cross-platform compatibility)
  if (existsSync(linkPath)) rmSync(linkPath, { recursive: true, force: true });
  symlinkSync(distDir, linkPath, 'junction');

  // Start HTTP server
  let server: Server;
  try {
    server = await startServer(serveDir);
  } catch (err: any) {
    console.error(`[prerender-full] Failed to start server: ${err.message}`);
    rmSync(serveDir, { recursive: true, force: true });
    process.exit(1);
  }

  let browser: any;
  let injected = 0;
  let failed = 0;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    for (const routePath of routes) {
      const url = `http://localhost:${PORT}${APP_BASE}${routePath === '/' ? '/' : routePath + '/'}`;
      console.log(`[prerender-full] Rendering ${routePath || '/'}...`);

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      } catch (err: any) {
        console.warn(`[prerender-full] Navigation timeout for ${routePath}: ${err.message}`);
        failed++;
        continue;
      }

      // Wait for React to render actual content (not just loading spinner).
      // PageStateWrapper shows .animate-spin during loading.
      // After data loads, React replaces it with the full mod list.
      try {
        await page.waitForFunction(
          () => {
            const root = document.getElementById('root');
            if (!root || root.children.length === 0) return false;
            // Check that the loading spinner is gone
            const spinner = root.querySelector('.animate-spin');
            return !spinner;
          },
          { timeout: 15000 },
        );
      } catch {
        console.warn(`[prerender-full] Content wait timeout for ${routePath}, using current state`);
      }

      // Additional buffer for React state updates, animations, and rendering
      await page.waitForTimeout(1500);

      // Extract rendered HTML from #root
      let rootHtml: string;
      try {
        rootHtml = await page.$eval('#root', (el: HTMLElement) => el.innerHTML);
      } catch (err: any) {
        console.warn(`[prerender-full] Failed to extract #root HTML for ${routePath}: ${err.message}`);
        failed++;
        continue;
      }

      // Find the HTML file for this route (created by prerender.ts)
      const htmlPath = routePath === '/'
        ? resolve(distDir, 'index.html')
        : resolve(distDir, routePath.slice(1), 'index.html');

      if (!existsSync(htmlPath)) {
        console.warn(`[prerender-full] HTML file not found: ${htmlPath}`);
        failed++;
        continue;
      }

      // Inject rendered content into <div id="root">
      let html = readFileSync(htmlPath, 'utf-8');
      // Match <div id="root"></div> or <div id="root"> </div> (with whitespace)
      const marker = /<div id="root">\s*<\/div>/;
      if (marker.test(html)) {
        html = html.replace(marker, `<div id="root">${rootHtml}</div>`);
        writeFileSync(htmlPath, html, 'utf-8');
        const sizeKB = (rootHtml.length / 1024).toFixed(1);
        console.log(`[prerender-full] ✓ ${routePath || '/'} — injected ${sizeKB} KB`);
        injected++;
      } else {
        console.warn(`[prerender-full] Could not find <div id="root"> in ${htmlPath}`);
        failed++;
      }
    }

    await browser.close();
  } catch (err: any) {
    console.error(`[prerender-full] Error: ${err.message}`);
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    failed = routes.length - injected;
  } finally {
    // Clean up: stop server, remove temp directory
    server.close();
    try {
      rmSync(serveDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }

  console.log(`[prerender-full] Done: ${injected} rendered, ${failed} failed out of ${routes.length} routes.`);

  if (failed > 0 && injected === 0) {
    console.error('[prerender-full] All pages failed. Falling back to shell prerender.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[prerender-full] Fatal error:', err);
  process.exit(1);
});
