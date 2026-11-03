/**
 * /kit gallery section for the Phase 2 explainer visuals and the lesson video player. Every sample
 * comes from the content bundle (each scene's final frame, steps applied), so §0.4 holds.
 */
import { useReducedMotion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { approvedChapters, type ContentBundle, type VisualName } from '@/content';
import { LessonVideo } from '@/features/video';
import { useBundle } from '@/state/content';
import { activeProps, sceneName } from './timeline';
import { VISUALS } from './visuals';
import './visuals/visuals.css';

interface Sample {
  key: string;
  title: string;
  visual: VisualName;
  subject: string;
  props: Record<string, unknown>;
}

/** Every distinct end-of-scene frame (and start frame, for scenes with steps) for one visual. */
function samplesFor(b: ContentBundle, visual: VisualName): Sample[] {
  const seen = new Set<string>();
  const out: Sample[] = [];
  for (const ex of b.explainers) {
    ex.scenes.forEach((sc, i) => {
      if (sc.visual !== visual) return;
      const frames = sc.steps?.length ? [0, Infinity] : [Infinity];
      for (const t of frames) {
        const props = activeProps(sc, t);
        const sig = JSON.stringify(props);
        if (seen.has(sig)) continue;
        seen.add(sig);
        out.push({
          key: `${ex.id}-${i}-${t}`,
          title: `${ex.id} · ${i + 1}${frames.length > 1 ? (t === 0 ? ' (start)' : ' (end)') : ''} · ${sceneName(sc, 4)}`,
          visual,
          subject: ex.subject,
          props,
        });
      }
    });
  }
  return out;
}

/** The first approved lesson that has an explainer video. */
function firstExplainerLesson(b: ContentBundle) {
  for (const ch of approvedChapters(b))
    for (const l of ch.lessons)
      if (l.videos.some((v) => v.kind === 'explainer')) return { lesson: l, subject: ch.subject };
  return undefined;
}

function Gallery({ samples, reduced }: { samples: Sample[]; reduced: boolean }) {
  return (
    <ul className="kit-visuals">
      {samples.map((s) => {
        const V = VISUALS[s.visual];
        return (
          <li key={s.key} data-sample={s.key}>
            <div className="kit-visual-stage">
              {V && <V props={s.props} subjectId={s.subject} reduced={reduced} />}
            </div>
            <p className="muted kit-visual-name">{s.title}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function ExplainerKit() {
  const bundle = useBundle();
  const reduced = useReducedMotion() ?? false;
  const particles = useMemo(() => samplesFor(bundle, 'ParticleBox'), [bundle]);
  const light = useMemo(() => samplesFor(bundle, 'LightRay'), [bundle]);
  const fractions = useMemo(() => samplesFor(bundle, 'FractionBar'), [bundle]);
  const lessonPick = useMemo(() => firstExplainerLesson(bundle), [bundle]);
  const [note, setNote] = useState('');

  return (
    <>
      {lessonPick && (
        <Card>
          <h2>Lesson video (explainer)</h2>
          <LessonVideo
            lesson={lessonPick.lesson}
            subjectId={lessonPick.subject}
            onWatched={(i) => setNote(i.checkpointsAllCorrect ? 'Watched: all ⭐ right' : 'Watched')}
            onUnavailable={() => setNote('No video: cards instead')}
          />
          {note && <p className="muted">{note}</p>}
        </Card>
      )}
      <Card>
        <h2>ParticleBox: every content frame</h2>
        <Gallery samples={particles} reduced={reduced} />
      </Card>
      <Card>
        <h2>LightRay</h2>
        <Gallery samples={light} reduced={reduced} />
      </Card>
      <Card>
        <h2>FractionBar: every content frame</h2>
        <Gallery samples={fractions} reduced={reduced} />
      </Card>
      <Card>
        <h2>NumberLine</h2>
        <div className="kit-visual-stage">
          {VISUALS.NumberLine && (
            <VISUALS.NumberLine
              props={{ min: -5, max: 5, start: -2, jumps: [5, -4] }}
              subjectId="maths"
              reduced={reduced}
            />
          )}
        </div>
      </Card>
    </>
  );
}
