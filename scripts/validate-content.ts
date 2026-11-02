/**
 * npm run validate-content [-- --dir <path>]
 *
 * Reads every JSON file under the content folder (default ./content), runs the pure validator in
 * src/content/validate.ts and prints a friendly report. Exits 1 when there are errors.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { rawFromFiles, type RawContent } from '../src/content/raw';
import { validateContent, type ValidationResult } from '../src/content/validate';

/** Reads all *.json files under `dir` (skipping media/). JSON syntax errors are returned separately. */
export function readContentDir(dir: string, cwd = process.cwd()): { raw: RawContent; parseErrors: string[] } {
  const absRoot = path.resolve(cwd, dir);
  const display = (path.relative(cwd, absRoot) || '.').replace(/\\/g, '/');
  const files: Record<string, unknown> = {};
  const parseErrors: string[] = [];

  const walk = (abs: string) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const full = path.join(abs, entry.name);
      const rel = path.relative(absRoot, full).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (rel !== 'media') walk(full);
      } else if (entry.name.endsWith('.json')) {
        let text = fs.readFileSync(full, 'utf8');
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip a BOM (Windows editors)
        try {
          files[`${display}/${rel}`] = JSON.parse(text);
        } catch (e) {
          parseErrors.push(
            `${display}/${rel}: is not valid JSON — ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }
  };
  if (!fs.existsSync(absRoot) || !fs.statSync(absRoot).isDirectory()) {
    return {
      raw: { root: display, chapters: [], explainers: [] },
      parseErrors: [`${display}: content folder not found`],
    };
  }
  walk(absRoot);
  return { raw: rawFromFiles(files, display), parseErrors };
}

export function runValidation(dir: string, cwd = process.cwd()): ValidationResult & { files: number } {
  const { raw, parseErrors } = readContentDir(dir, cwd);
  const result = validateContent(raw);
  const files =
    [raw.subjects, raw.timetable, raw.plan, raw.blueprint].filter(Boolean).length +
    raw.chapters.length +
    raw.explainers.length;
  return { errors: [...parseErrors, ...result.errors], warnings: result.warnings, files };
}

function parseArgs(argv: string[]): { dir: string } {
  let dir = 'content';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--dir') dir = argv[++i] ?? dir;
    else if (a.startsWith('--dir=')) dir = a.slice('--dir='.length);
  }
  return { dir };
}

function main(): number {
  const { dir } = parseArgs(process.argv.slice(2));
  const useColour = process.stdout.isTTY && !process.env.NO_COLOR;
  const c = (code: string) => (s: string) => (useColour ? `\x1b[${code}m${s}\x1b[0m` : s);
  const red = c('31');
  const yellow = c('33');
  const green = c('32');
  const bold = c('1');
  const dim = c('2');

  const { errors, warnings, files } = runValidation(dir);
  console.log(bold(`\n🐘 Checking content in ${dir}/ (${files} file${files === 1 ? '' : 's'})\n`));

  if (errors.length) {
    console.log(red(bold(`✖ ${errors.length} error${errors.length === 1 ? '' : 's'} — please fix:`)));
    for (const e of errors) console.log(`  ${red('•')} ${e}`);
    console.log('');
  }
  if (warnings.length) {
    console.log(
      yellow(
        bold(`⚠ ${warnings.length} warning${warnings.length === 1 ? '' : 's'} (OK to ship, worth a look):`),
      ),
    );
    for (const w of warnings) console.log(`  ${yellow('•')} ${dim(w)}`);
    console.log('');
  }
  if (errors.length) {
    console.log(red('Content check failed.'));
    return 1;
  }
  console.log(
    green(bold('✔ Content looks good!')) +
      (warnings.length ? dim(` (${warnings.length} warning${warnings.length === 1 ? '' : 's'})`) : ''),
  );
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) process.exit(main());
