// Smoke test against a deployed URL (M5). Never generates a question, so it costs nothing,
// and never reads backend/.env. Usage: npm run check:live -- https://<deployment-url>
// Pass --skip-headers to run it against the local `vite preview`, which does not apply vercel.json.
const args = process.argv.slice(2);
const skipHeaders = args.includes('--skip-headers');
const base = args.find((arg) => !arg.startsWith('--'))?.replace(/\/$/, '');

if (!base) {
  console.error('check-live: missing URL. Usage: npm run check:live -- https://<deployment-url>');
  process.exit(1);
}

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

async function get(path, init) {
  const response = await fetch(base + path, { redirect: 'manual', ...init });
  return { response, text: await response.text() };
}

const isShell = (text) => text.includes('<div id="root"></div>');
const isJson = (response) => (response.headers.get('content-type') ?? '').includes('application/json');

// App shell on every UI route, including a refresh on an inner route.
for (const path of ['/', '/trivia', '/about']) {
  const { response, text } = await get(path);
  check(response.status === 200 && isShell(text), `${path}: expected 200 with the app shell (got ${response.status})`);
}

// PWA files.
const manifestRes = await get('/manifest.webmanifest');
check(manifestRes.response.status === 200, '/manifest.webmanifest is not served');
if (manifestRes.response.status === 200) {
  const manifest = JSON.parse(manifestRes.text);
  check(manifest.lang === 'he' && manifest.dir === 'rtl', 'manifest is not Hebrew RTL');
}
const swRes = await get('/sw.js');
check(swRes.response.status === 200 && !isShell(swRes.text), '/sw.js is not served');

// Security and cache headers from vercel.json.
if (!skipHeaders) {
  const { response } = await get('/');
  const csp = response.headers.get('content-security-policy') ?? '';
  check(csp.includes("frame-ancestors 'none'"), "CSP with frame-ancestors 'none' is missing");
  check(response.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff is missing');
  check(Boolean(response.headers.get('strict-transport-security')), 'HSTS header is missing');
  check(
    (swRes.response.headers.get('cache-control') ?? '').includes('max-age=0'),
    '/sw.js is not served with max-age=0',
  );
}

// API answers with JSON and no-store, never with the app shell; bad requests are rejected.
const apiGet = await get('/api/v1/questions');
check(isJson(apiGet.response) && !isShell(apiGet.text), 'GET /api/v1/questions did not return JSON');
check(apiGet.response.status === 405, `GET /api/v1/questions: expected 405 (got ${apiGet.response.status})`);
check(apiGet.response.headers.get('cache-control') === 'no-store', 'API response is missing Cache-Control: no-store');

const wrongType = await get('/api/v1/questions', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
check(wrongType.response.status === 415 && isJson(wrongType.response), `POST with wrong Content-Type: expected 415 (got ${wrongType.response.status})`);

const foreignOrigin = await get('/api/v1/questions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' },
  body: '{}',
});
check(foreignOrigin.response.status === 403 && isJson(foreignOrigin.response), `POST from a foreign Origin: expected 403 (got ${foreignOrigin.response.status})`);

// No secret in the served HTML/JS, and no .env file reachable.
const indexText = (await get('/')).text;
const scripts = [...indexText.matchAll(/src="(\/[^"]+\.js)"/g)].map((match) => match[1]);
for (const path of ['/', '/sw.js', '/registerSW.js', ...scripts]) {
  const { text } = await get(path);
  check(!text.includes('OPENAI_API_KEY'), `${path} contains OPENAI_API_KEY`);
  check(!/sk-[A-Za-z0-9_-]{16,}/.test(text), `${path} contains an sk-... key`);
  check(!/VITE_[A-Z0-9_]+/.test(text), `${path} contains a VITE_ variable`);
}
for (const path of ['/.env', '/backend/.env']) {
  const { response, text } = await get(path);
  check(response.status === 404 || isShell(text), `${path} is reachable (status ${response.status})`);
}

if (failures.length) {
  console.error(`check-live: ${failures.length} problem(s) at ${base}`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`check-live: OK — ${base}`);
