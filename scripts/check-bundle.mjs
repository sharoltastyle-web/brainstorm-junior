// Scans the built client bundle (dist/) for anything that looks like the AI secret.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const ENV_FILE = join('backend', '.env');

if (!existsSync(DIST)) {
  console.error('check-bundle: dist/ not found. Run "npm run build" first.');
  process.exit(1);
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

// Compare against the real key too, without ever printing it.
let realKey = '';
if (existsSync(ENV_FILE)) {
  const match = readFileSync(ENV_FILE, 'utf8').match(/^OPENAI_API_KEY=(.*)$/m);
  realKey = match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
}

const patterns = [
  { label: 'OPENAI_API_KEY name', test: (text) => text.includes('OPENAI_API_KEY') },
  { label: 'OpenAI-style key (sk-...)', test: (text) => /sk-[A-Za-z0-9_-]{16,}/.test(text) },
  { label: 'VITE_ variable', test: (text) => /VITE_[A-Z0-9_]+/.test(text) },
];
if (realKey) patterns.push({ label: 'value of the configured key', test: (text) => text.includes(realKey) });

const textFiles = listFiles(DIST).filter((file) => /\.(js|css|html|json|webmanifest|map|txt)$/.test(file));
const findings = [];
for (const file of textFiles) {
  const text = readFileSync(file, 'utf8');
  for (const { label, test } of patterns) if (test(text)) findings.push(`${file}: ${label}`);
}

if (findings.length) {
  console.error('check-bundle: FAILED\n' + findings.join('\n'));
  process.exit(1);
}
console.log(
  `check-bundle: OK (${textFiles.length} files scanned; real key ${realKey ? 'compared' : 'not set, pattern checks only'})`,
);
