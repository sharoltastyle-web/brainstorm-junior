// @vitest-environment node
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasOpenAiKey, loadServerEnv } from './env.js';

describe('server env loading', () => {
  const originalKey = process.env.OPENAI_API_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });

  it('does not fail when the env file is missing', () => {
    expect(() => loadServerEnv(join(tmpdir(), 'does-not-exist', '.env'))).not.toThrow();
  });

  it('loads the key from a file and reports only a boolean', () => {
    delete process.env.OPENAI_API_KEY;
    const dir = mkdtempSync(join(tmpdir(), 'bsj-env-'));
    const file = join(dir, '.env');
    writeFileSync(file, 'OPENAI_API_KEY=sk-test-from-file\n');
    loadServerEnv(file);
    expect(hasOpenAiKey()).toBe(true);
  });

  it('treats an empty key as missing', () => {
    process.env.OPENAI_API_KEY = '   ';
    expect(hasOpenAiKey()).toBe(false);
  });
});

describe('secret separation', () => {
  function listFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? listFiles(path) : [path];
    });
  }

  it('no frontend file imports from backend/ or reads the AI key', () => {
    const offenders = listFiles('src')
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        return /from\s+['"][^'"]*backend/.test(source) || source.includes('OPENAI_API_KEY');
      });
    expect(offenders).toEqual([]);
  });

  it('the example env file contains only an empty key', () => {
    expect(readFileSync('backend/.env.example', 'utf8').trim()).toBe('OPENAI_API_KEY=');
  });
});
