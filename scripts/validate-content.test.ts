import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readContentDir, runValidation } from './validate-content';

describe('validate-content CLI helpers', () => {
  it('the real content folder has zero errors', () => {
    const r = runValidation('content');
    expect(r.errors).toEqual([]);
    expect(r.files).toBeGreaterThanOrEqual(7);
  });

  it('the broken fixture fails with file + path messages', () => {
    const r = runValidation('scripts/__fixtures__/broken');
    expect(r.errors.length).toBe(5);
    expect(r.errors).toContain(
      'scripts/__fixtures__/broken/chapters/physics/broken.json › lessons[0].check: needs at least 3 questions (found 2)',
    );
  });

  it('reports invalid JSON and a missing folder', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-'));
    try {
      fs.writeFileSync(path.join(dir, 'plan.json'), '{ "startDate": ');
      const { parseErrors, raw } = readContentDir(dir, dir);
      expect(parseErrors[0]).toMatch(/plan\.json: is not valid JSON/);
      expect(raw.plan).toBeUndefined();
      expect(runValidation(path.join(dir, 'nope'), dir).errors[0]).toMatch(/content folder not found/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
