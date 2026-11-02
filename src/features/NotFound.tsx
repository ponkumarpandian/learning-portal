import { ChunkyLink } from '@/components/ChunkyButton';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { useMascotName } from '@/state/settingsStore';

/** Unknown routes: a friendly empty state, never an error page. */
export function NotFound() {
  const mascot = useMascotName();
  return (
    <Screen labelledBy="nf-h">
      <EmptyState
        as="h1"
        headingId="nf-h"
        title="Oops, this path is not on the map! 🗺️"
        body={`${mascot} looked everywhere. Let’s head back to your trail.`}
        action={
          <ChunkyLink to="/" arrow>
            Back to my trail
          </ChunkyLink>
        }
      />
    </Screen>
  );
}
