import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

// The seed subject colours in content/subjects.json are the tokens.css --<subject> fills. While they
// match, subjectVars() uses the contrast-checked token; a changed colour is treated as an override.
describe('subject colours', () => {
  it('content/subjects.json uses the tokens.css colour for every built-in subject', () => {
    const css = fs.readFileSync('src/styles/tokens.css', 'utf8');
    const subjects = JSON.parse(fs.readFileSync('content/subjects.json', 'utf8')) as {
      id: string;
      colour: string;
    }[];
    let checked = 0;
    for (const s of subjects) {
      const m = new RegExp(String.raw`--${s.id}:\s*(#[0-9a-fA-F]{6});`).exec(css);
      if (!m) continue; // a subject without a token uses its JSON hex
      checked++;
      expect(`${s.id} ${s.colour.toLowerCase()}`).toBe(`${s.id} ${m[1]!.toLowerCase()}`);
    }
    expect(checked).toBeGreaterThanOrEqual(7);
  });
});
