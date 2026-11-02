import { subjectVars, type ColourVars } from '@/components/colours';
import { getSubject } from '@/content';
import { useBundle } from '@/state/content';

/** --s / --sd / --on-s for a subject id (undefined → inherit from the player stage). */
export function useSubjectVars(subjectId: string | undefined): ColourVars | undefined {
  const bundle = useBundle();
  if (!subjectId) return undefined;
  return subjectVars(getSubject(bundle, subjectId));
}
