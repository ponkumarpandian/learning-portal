import { Card } from '@/components/Card';
import { ChunkyLink } from '@/components/ChunkyButton';
import { Screen } from '@/components/layout/Screen';

/** /parent (§11). Placeholder: the PIN lock and the parent tools arrive in Phase 6. */
export function ParentPlaceholder() {
  return (
    <Screen labelledBy="parent-h">
      <Card className="parent-card">
        <p className="eyebrow">Parent area</p>
        <h1 id="parent-h" tabIndex={-1}>
          Grown-ups area
        </h1>
        <p className="mt-3">
          This is where the dashboard, test review, Content Manager, plan settings, timetable editor and
          backup will live.
        </p>
        <p>
          <b>The 4-digit PIN lock comes in Phase 6.</b> Until then there is nothing here to change.
        </p>
      </Card>
      <ChunkyLink to="/me" variant="soft">
        Back to the app
      </ChunkyLink>
    </Screen>
  );
}
