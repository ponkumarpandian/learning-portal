/**
 * Turns a flat map of content JSON files into the RawContent shape that validateContent() and the
 * loader understand. Pure: used by the app (import.meta.glob) and by scripts/validate-content.ts (fs).
 */

export interface RawFile {
  /** Display path, e.g. "content/chapters/physics/light.json" */
  file: string;
  data: unknown;
}

export interface RawContent {
  /** Display prefix for files that are missing, e.g. "content" */
  root?: string;
  subjects?: RawFile;
  timetable?: RawFile;
  plan?: RawFile;
  blueprint?: RawFile;
  chapters: RawFile[];
  explainers: RawFile[];
  /** JSON files that don't belong anywhere (reported as warnings) */
  unknown?: string[];
}

const ROOT_FILES = {
  'subjects.json': 'subjects',
  'timetable.json': 'timetable',
  'plan.json': 'plan',
  'test-blueprint.json': 'blueprint',
} as const;

/**
 * @param files keys are paths ("/content/plan.json", "content\\plan.json", "C:/x/content/plan.json" …)
 * @param root  the content folder name/prefix as it appears in the keys, e.g. "/content" or "scripts/__fixtures__/broken"
 */
export function rawFromFiles(files: Record<string, unknown>, root: string): RawContent {
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
  const rootN = norm(root);
  const display = rootN.replace(/^\/+/, '');
  const raw: RawContent = { root: display, chapters: [], explainers: [], unknown: [] };

  for (const key of Object.keys(files).sort()) {
    const k = norm(key);
    const rel = k.startsWith(rootN + '/') ? k.slice(rootN.length + 1) : k;
    const file = `${display}/${rel}`;
    const entry: RawFile = { file, data: files[key] };
    if (rel.startsWith('media/')) continue;
    const rootKind = ROOT_FILES[rel as keyof typeof ROOT_FILES];
    if (rootKind) raw[rootKind] = entry;
    else if (/^chapters\/.+\.json$/.test(rel)) raw.chapters.push(entry);
    else if (/^explainers\/.+\.json$/.test(rel)) raw.explainers.push(entry);
    else raw.unknown!.push(file);
  }
  return raw;
}
