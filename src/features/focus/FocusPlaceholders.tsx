import { useParams } from 'react-router';
import { ChunkyLink } from '@/components/ChunkyButton';
import { EmptyState } from '@/components/EmptyState';
import { FocusHeader } from '@/components/FocusHeader';
import { Screen } from '@/components/layout/Screen';
import { useBundle } from '@/state/content';

const back = (
  <ChunkyLink to="/" arrow>
    Back to my trail
  </ChunkyLink>
);

/* The lesson route (/lesson/:date/:slot) is the real lesson now: src/features/lesson/LessonScreen.tsx. */

function FocusPlaceholder({
  id,
  what,
  eyebrow,
  title,
  line,
}: {
  id: string;
  what: string;
  eyebrow: string;
  title: string;
  line: string;
}) {
  return (
    <Screen labelledBy={id}>
      <FocusHeader eyebrow={eyebrow} title={title} titleId={id} what={what} />
      <EmptyState title="Coming soon! 🛠️" body={line} action={back} />
    </Screen>
  );
}

/** /test/:testId (§8.3, Phase 4) */
export function TestPlaceholder() {
  const { testId = '' } = useParams();
  return (
    <FocusPlaceholder
      id="test-h"
      what="test"
      eyebrow="🖥️ Online test"
      title={
        testId.endsWith('sun') ? 'Sunday Test' : testId.endsWith('sat') ? 'Saturday Test' : 'Weekly test'
      }
      line="Your weekly tests open in a later part of your adventure."
    />
  );
}

/** /results/:id (§8.4, Phase 4) */
export function ResultsPlaceholder() {
  return (
    <FocusPlaceholder
      id="results-h"
      what="results"
      eyebrow="✅ Results"
      title="Your results"
      line="Your report card and fix-it list will live here."
    />
  );
}

/** /revise/:subject (Phase 3+) */
export function RevisePlaceholder() {
  const { subject = '' } = useParams();
  const bundle = useBundle();
  const s = bundle.subjects.find((x) => x.id === subject);
  return (
    <FocusPlaceholder
      id="revise-h"
      what="revision"
      eyebrow="🔁 Revise"
      title={s ? `${s.emoji} ${s.name}` : 'Revision'}
      line="Flashcards and a mixed quiz will help you remember. Coming soon!"
    />
  );
}
