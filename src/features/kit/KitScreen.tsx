import { useState } from 'react';
import { BottomSheet, type SheetTone } from '@/components/BottomSheet';
import { Card } from '@/components/Card';
import { Caterpillar } from '@/components/Caterpillar';
import { Chip, ChipRow } from '@/components/Chip';
import { ChunkyButton } from '@/components/ChunkyButton';
import { OptionButton, type OptionState } from '@/components/OptionButton';
import { ProgressRing } from '@/components/ProgressRing';
import { RestStop } from '@/components/RestStop';
import { Stone } from '@/components/Stone';
import { StickerBadge } from '@/components/StickerBadge';
import { Tara } from '@/components/Tara';
import { subjectVars, tokenVars, type ColourVars } from '@/components/colours';
import { Screen } from '@/components/layout/Screen';
import { approvedChapters, WEEKDAYS, type ContentBundle, type Question, type Slot } from '@/content';
import { ExplainerKit } from '@/explainers/ExplainerKit';
import { QuestionsKit } from '@/features/questions/QuestionsKit';
import { useBundle } from '@/state/content';
import { BADGES } from '../progress/badges';
import { fmtRange, fmtTime, isStone, shortLabel } from '../today/todayModel';

interface KitStone {
  name: string;
  emoji: string;
  time: string;
  start: string;
  vars: ColourVars;
}

/** Sample stones, a rest stop and an mcq, all read from /content (§0.4: nothing hard-coded here). */
function kitSamples(b: ContentBundle) {
  const subjects = new Map(b.subjects.map((s) => [s.id, s]));
  const all: Slot[] = WEEKDAYS.flatMap((d) => b.timetable.days[d] ?? []);
  const stones: KitStone[] = all
    .filter((s) => isStone(s) && s.kind !== 'test')
    .map((s) => {
      const subject = subjects.get(s.subject ?? s.subjects?.[0] ?? '');
      return {
        name: subject?.name ?? s.label ?? 'Study time',
        emoji: subject?.emoji ?? s.emoji ?? '⭐',
        time: fmtRange(s),
        start: s.start,
        vars: subjectVars(subject),
      };
    })
    .filter((st, i, arr) => arr.findIndex((o) => o.name === st.name) === i)
    .slice(0, 4);
  const restSlot = all.find((s) => !isStone(s) && s.kind !== 'break');
  const rest = restSlot && {
    label: shortLabel(restSlot.label ?? ''),
    emoji: restSlot.emoji ?? '🎈',
    time: fmtRange(restSlot),
    vars: tokenVars(restSlot.colour ?? 'fun'),
  };
  const chapters = approvedChapters(b);
  const questions: Question[] = chapters.flatMap((c) => [
    ...c.questionBank,
    ...c.lessons.flatMap((l) => [...l.practice, ...l.check]),
  ]);
  const mcq = questions.find((q) => q.type === 'mcq' && q.options && typeof q.answer === 'string');
  const hint = questions.find((q) => q.hints?.length)?.hints?.[0];
  return { stones, rest, mcq, hint };
}

/**
 * Dev/QA-only component gallery (/kit, only in dev builds or VITE_ALLOW_FAKE_CLOCK=1 builds): every
 * shared component in its states, for screenshots and visual review. Sample text is from Appendix B.
 */
export function KitScreen() {
  const [picked, setPicked] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetTone | null>(null);
  const bundle = useBundle();
  const lockedBadge = BADGES.at(-1);
  const { stones, rest, mcq, hint } = kitSamples(bundle);
  const [first, second, third, fourth] = stones;
  const accent = second?.vars ?? tokenVars('fun');
  const options = mcq?.options ?? [];
  const rightIdx = mcq ? options.indexOf(String(mcq.answer)) : -1;
  const triedIdx = options.findIndex((_, i) => i !== rightIdx);
  const stateOf = (i: number): OptionState => (i === rightIdx ? 'right' : i === triedIdx ? 'tried' : 'idle');

  return (
    <Screen labelledBy="kit-h">
      <header className="page-head">
        <h1 id="kit-h" tabIndex={-1}>
          Component kit{' '}🧩
        </h1>
        <p>Every building block in its states.</p>
      </header>

      <Card>
        <h2>Tara</h2>
        <div className="kit-row">
          <Tara mood="happy" />
          <Tara mood="cheer" />
          <Tara mood="sleepy" />
        </div>
      </Card>

      <Card>
        <h2>Buttons + chips</h2>
        <ChunkyButton arrow>Start {second?.name ?? 'here'}</ChunkyButton>
        <ChunkyButton variant="soft">Next: learn cards</ChunkyButton>
        <ChunkyButton disabled>Check my answer</ChunkyButton>
        <ChipRow>
          <Chip value="🔥 6" label="day streak" />
          <Chip value="⭐ 128" label="stars" />
          <Chip value="📅 31" label="days to exams" />
        </ChipRow>
      </Card>

      <Card>
        <h2>Stones + rest stops</h2>
        <div className="kit-stones" style={{ height: 'calc(230 * var(--px))' }}>
          {[first, second, third].map((st, i) =>
            st ? (
              <div key={st.name} style={{ left: `${15 + 35 * i}%`, top: 'calc(100 * var(--px))' }}>
                <Stone
                  name={st.name}
                  emoji={st.emoji}
                  time={st.time}
                  state={(['done', 'now', 'later'] as const)[i] ?? 'later'}
                  vars={st.vars}
                />
              </div>
            ) : null,
          )}
        </div>
        <div className="kit-stones" style={{ height: 'calc(150 * var(--px))' }}>
          {fourth && (
            <div style={{ left: '25%', top: 'calc(40 * var(--px))' }}>
              <Stone
                name={fourth.name}
                emoji={fourth.emoji}
                time={fourth.time}
                state="catchup"
                vars={fourth.vars}
              />
            </div>
          )}
          {rest && (
            <div style={{ left: '70%', top: 'calc(40 * var(--px))' }}>
              <RestStop label={rest.label} emoji={rest.emoji} time={rest.time} vars={rest.vars} />
            </div>
          )}
        </div>
      </Card>

      <Card style={accent}>
        <h2>Caterpillar + options</h2>
        <Caterpillar current={2} vars={accent} />
        <div className="options mt-5" role="radiogroup" aria-label={mcq?.prompt ?? 'Sample question'}>
          {options.map((o, i) => (
            <OptionButton
              key={o}
              name="kit-q"
              value={String(i)}
              letter={'ABCD'[i] ?? ''}
              text={o}
              checked={(picked ?? String(rightIdx)) === String(i)}
              onChange={setPicked}
              state={stateOf(i)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <h2>Progress ring + stickers</h2>
        <div className="kit-row">
          <ProgressRing value={1} max={4} label="Lessons done today" />
          <ProgressRing value={3} max={4} label="Lessons done today" size={96} stroke={12} />
        </div>
        <ul className="stickers">
          {BADGES.slice(0, 4).map((b, i) => (
            <StickerBadge
              key={b.id}
              name={b.name}
              emoji={b.emoji}
              colour={b.colour}
              tilt={[-6, 4, -3, 5][i]}
            />
          ))}
          {lockedBadge && (
            <StickerBadge
              name={lockedBadge.name}
              emoji={lockedBadge.emoji}
              colour={lockedBadge.colour}
              locked
            />
          )}
        </ul>
      </Card>

      <Card>
        <h2>Bottom sheets</h2>
        <div className="grid gap-2">
          <ChunkyButton variant="soft" onClick={() => setSheet('ok')}>
            Correct feedback
          </ChunkyButton>
          <ChunkyButton variant="soft" onClick={() => setSheet('hint')}>
            Hint feedback
          </ChunkyButton>
          <ChunkyButton variant="soft" onClick={() => setSheet('plain')}>
            Not ready yet
          </ChunkyButton>
        </div>
      </Card>

      <ExplainerKit />

      <QuestionsKit />

      <BottomSheet
        open={sheet !== null}
        tone={sheet ?? 'plain'}
        icon={sheet === 'ok' ? '⭐' : <Tara size="fill" label={null} />}
        title={
          sheet === 'ok'
            ? 'Yes! ⭐ Spot on!'
            : sheet === 'hint'
              ? 'Almost! Here’s a clue 💡'
              : `${first?.name ?? 'This stone'} starts at ${fmtTime(first?.start ?? '00:00')}.`
        }
        body={
          sheet === 'ok'
            ? (mcq?.explanation ?? '')
            : sheet === 'hint'
              ? (hint ?? '')
              : 'Finish the glowing stone first!'
        }
        primary={{
          label: sheet === 'hint' ? 'Try again' : sheet === 'ok' ? 'Continue' : 'OK, got it',
          onClick: () => setSheet(null),
        }}
      />
    </Screen>
  );
}
