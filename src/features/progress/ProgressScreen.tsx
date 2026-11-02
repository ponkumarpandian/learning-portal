import { Card } from '@/components/Card';
import { LevelMedal } from '@/components/LevelMedal';
import { ProgressBar } from '@/components/ProgressBar';
import { TaraSays } from '@/components/SpeechBubble';
import { StickerBadge } from '@/components/StickerBadge';
import { StreakRow } from '@/components/StreakRow';
import { Screen } from '@/components/layout/Screen';
import { BADGES } from './badges';

const LAST_7 = ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Today'].map((label) => ({ label, lit: false }));

/**
 * Rewards (§10, §15.1). Phase 0 placeholder with the real components: level medal, streak row and a
 * sticker book where every sticker is still locked. Stars, streak and badge rules arrive in Phase 3.
 */
export function ProgressScreen() {
  return (
    <Screen labelledBy="prog-h">
      <TaraSays small mood="cheer">
        <h1 className="greet" id="prog-h" tabIndex={-1}>
          Your rewards!{' '}🏆
        </h1>
        <p>Every lesson you finish brings a star closer.</p>
      </TaraSays>

      <Card className="level" aria-label="Your level">
        <LevelMedal level={1} />
        <div>
          <p className="eyebrow">Level 1</p>
          <h2>Explorer</h2>
          <ProgressBar value={0} max={100} label="Stars to the next level" big />
          <p className="muted">
            ⭐ 0 stars · 100 more to <b>Thinker</b>
          </p>
        </div>
      </Card>

      <Card aria-labelledby="streak-h">
        <h2 id="streak-h">Your last 7 days</h2>
        <StreakRow days={LAST_7} />
        <p className="shield">
          <span aria-hidden="true">🛡️</span> <span>Your streak shield is ready this week.</span>
        </p>
      </Card>

      <Card aria-labelledby="stick-h">
        <div className="card-head">
          <h2 id="stick-h">Sticker book</h2>
          <span className="muted">0 of {BADGES.length}</span>
        </div>
        <ul className="stickers">
          {BADGES.map((b) => (
            <StickerBadge key={b.id} name={b.name} emoji={b.emoji} colour={b.colour} locked />
          ))}
        </ul>
        <p className="soon mt-5">
          <span aria-hidden="true">✨</span>
          <span>Stickers start unlocking soon. Your first one is just one lesson away!</span>
        </p>
      </Card>
    </Screen>
  );
}
