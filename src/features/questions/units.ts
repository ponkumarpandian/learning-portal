/**
 * Unit families for the numeric unit picker (§8.2 "number pad, with a unit picker if needed").
 * These are app rules (SI spellings), not syllabus content: the question's own `unit` decides which
 * family is shown, and a unit outside every family is shown as a fixed label instead.
 */
const FAMILIES: readonly (readonly string[])[] = [
  ['mm', 'cm', 'm', 'km'],
  ['mg', 'g', 'kg'],
  ['mL', 'L'],
  ['s', 'min', 'h'],
  ['°C', 'K'],
  ['N', 'kN'],
  ['cm²', 'm²', 'km²'],
  ['cm³', 'm³'],
  ['m/s', 'km/h'],
  ['%'],
];

/** The picker choices for a question unit, or [] when the unit stands alone (shown as a label). */
export function unitChoices(unit: string | undefined): string[] {
  if (!unit?.trim()) return [];
  const family = FAMILIES.find((f) => f.includes(unit.trim()));
  return family && family.length > 1 ? [...family] : [];
}

/** Turns what she typed into a number: "3,5" and " 3.5 " both read 3.5; blank or junk → null. */
export function parseNumber(text: string): number | null {
  const t = text.replace(/\s+/g, '').replace(',', '.');
  if (!t || t === '-' || t === '.') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
