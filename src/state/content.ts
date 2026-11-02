import { create } from 'zustand';
import { loadContent, type ContentBundle } from '@/content';
import { listOverrides } from '@/db/repos/contentOverrides';

interface ContentState {
  bundle: ContentBundle;
  /** Re-merges the parent's overrides from Dexie (call after an edit, and once at start-up). */
  refresh: () => Promise<void>;
}

/** Bundled /content merged with the parent's overrides. Starts with the bundled files (synchronous). */
export const useContent = create<ContentState>()((set) => ({
  bundle: loadContent(),
  refresh: async () => {
    try {
      const overrides = await listOverrides();
      if (overrides.length) set({ bundle: loadContent(overrides) });
    } catch {
      /* storage blocked: keep the bundled content */
    }
  },
}));

export const useBundle = () => useContent((s) => s.bundle);
