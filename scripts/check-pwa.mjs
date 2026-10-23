// Verifies the PWA output in dist/: manifest, service worker registration, precache contents
// and that the API is never cached or answered with the app shell. Run after "npm run build".
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

if (!existsSync(DIST)) {
  console.error('check-pwa: dist/ not found. Run "npm run build" first.');
  process.exit(1);
}

// Manifest
const manifestPath = join(DIST, 'manifest.webmanifest');
check(existsSync(manifestPath), 'manifest.webmanifest is missing');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
check(manifest.lang === 'he', 'manifest lang is not "he"');
check(manifest.dir === 'rtl', 'manifest dir is not "rtl"');
check(manifest.display === 'standalone', 'manifest display is not "standalone"');
check(manifest.start_url === '/' && manifest.scope === '/', 'manifest start_url/scope are not "/"');
const icons = manifest.icons ?? [];
check(icons.some((icon) => icon.sizes === '192x192'), 'manifest has no 192x192 icon');
check(icons.some((icon) => icon.sizes === '512x512' && (icon.purpose ?? 'any') === 'any'), 'manifest has no 512x512 icon');
check(icons.some((icon) => icon.purpose === 'maskable'), 'manifest has no maskable icon');
for (const icon of icons) check(existsSync(join(DIST, icon.src)), `icon file missing: ${icon.src}`);

// index.html links the manifest and registers the service worker
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
check(html.includes('rel="manifest"'), 'index.html does not link the manifest');
check(html.includes('registerSW.js'), 'index.html does not load the service worker registration');

// Service worker
const swPath = join(DIST, 'sw.js');
check(existsSync(swPath), 'sw.js is missing');
const sw = existsSync(swPath) ? readFileSync(swPath, 'utf8') : '';
const precached = [...sw.matchAll(/\{url:"([^"]+)"/g)].map((match) => match[1]);

check(precached.includes('index.html'), 'index.html is not precached');
check(precached.some((url) => url.endsWith('.js') && url.startsWith('assets/')), 'app JS is not precached');
check(precached.some((url) => url.endsWith('.css')), 'app CSS is not precached');
for (const image of ['logo.png', 'hero.png', 'about.png', 'background.png'])
  check(precached.includes(`images/${image}`), `images/${image} is not precached`);
for (const icon of icons) check(precached.includes(icon.src.replace(/^\//, '')), `icon is not precached: ${icon.src}`);
check(precached.some((url) => /rubik-hebrew-.*\.woff2$/.test(url)), 'Rubik Hebrew font is not precached');
check(precached.some((url) => /nunito-sans-latin-.*\.woff2$/.test(url)), 'Nunito Sans font is not precached');

const forbidden = precached.filter((url) => /(^|\/)api\/|\.env|backend\//.test(url));
check(forbidden.length === 0, `forbidden entries precached: ${forbidden.join(', ')}`);

check(sw.includes('denylist:[/^\\/api\\//]'), 'navigation fallback does not exclude /api/');
check(/startsWith\("\/api\/"\),new \w+\.NetworkOnly/.test(sw), 'no NetworkOnly route for /api/');
// skipWaiting may only run on an explicit message (never sent by the app), so updates never force a reload.
check(!/skipWaiting\(\)(?!\})/.test(sw.replace(/"SKIP_WAITING"===\w+\.data\.type&&self\.skipWaiting\(\)/, '')), 'service worker calls skipWaiting unconditionally');
check(!sw.includes('clientsClaim'), 'service worker claims clients immediately');

if (failures.length) {
  console.error('check-pwa: FAILED\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`check-pwa: OK (${precached.length} precached files, ${icons.length} manifest icons)`);
