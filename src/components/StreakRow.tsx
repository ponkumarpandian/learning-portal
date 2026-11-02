export interface StreakDay {
  label: string;
  lit: boolean;
}

/** Last 7 days as 42px discs: 🔥 on --fun when lit, a dashed ring with a faded 🔥 when not yet. */
export function StreakRow({ days }: { days: readonly StreakDay[] }) {
  return (
    <ol className="streak">
      {days.map((d, i) => (
        <li key={`${d.label}-${i}`}>
          <div className={d.lit ? 'flame' : 'flame todo'} aria-hidden="true">
            <span>🔥</span>
          </div>
          <small>
            {d.label}
            <span className="sr-only">{d.lit ? ', streak day' : ', not yet'}</span>
          </small>
        </li>
      ))}
    </ol>
  );
}
