/**
 * Media under /content/media (images, MP4s) bundled by Vite, so they are cached for offline use.
 * Content refers to them by path, e.g. "media/images/che-matter-fig3-9.svg".
 */
const files = import.meta.glob<string>('/content/media/**', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** The bundled URL for a content media path ("media/…", "content/media/…" or "/content/media/…"). */
export function mediaUrl(path: string): string | undefined {
  const clean = path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\/+/, '')
    .replace(/^content\//, '');
  if (!clean || clean.includes('..')) return undefined;
  return files[`/content/${clean}`];
}
