import subjects from '@content/subjects.json';
import { SUBJECT_TOKEN_HEX, onColour, subjectVars } from './colours';

describe('subjectVars', () => {
  // scripts/tokens-sync.test.ts checks the seed subjects.json against tokens.css
  it('SUBJECT_TOKEN_HEX matches the seed subjects.json', () => {
    for (const [id, hex] of Object.entries(SUBJECT_TOKEN_HEX)) {
      expect(subjects.find((s) => s.id === id)?.colour.toLowerCase()).toBe(hex);
    }
  });

  it('uses the contrast-checked token while the colour is unchanged', () => {
    expect(subjectVars({ id: 'maths', colour: '#3F7BF6' })).toMatchObject({
      '--s': 'var(--maths)',
      '--on-s': 'var(--on-maths)',
    });
  });

  it('uses an overridden colour for a built-in subject, with a computed on-colour', () => {
    const v = subjectVars({ id: 'maths', colour: '#ffe066' });
    expect(v['--s']).toBe('#ffe066');
    expect(v['--sd']).toContain('#ffe066');
    expect(v['--on-s']).toBe('#1b2845');
  });

  it('uses the JSON hex for a new subject', () => {
    expect(subjectVars({ id: 'sanskrit', colour: '#5b21b6' })).toMatchObject({
      '--s': '#5b21b6',
      '--on-s': '#ffffff',
    });
  });

  it('picks white or dark ink by contrast', () => {
    expect(onColour('#000000')).toBe('#ffffff');
    expect(onColour('#ffffff')).toBe('#1b2845');
  });
});
