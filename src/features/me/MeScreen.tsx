import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BottomSheet } from '@/components/BottomSheet';
import { Card } from '@/components/Card';
import { ChunkyButton } from '@/components/ChunkyButton';
import { SegmentedControl, type SegmentOption } from '@/components/SegmentedControl';
import { TaraSays } from '@/components/SpeechBubble';
import { WorldPicker } from '@/components/WorldPicker';
import { Screen } from '@/components/layout/Screen';
import type { Settings } from '@/db/repos/settings';
import { useSettings } from '@/state/settingsStore';

const NIGHT: readonly SegmentOption<Settings['night']>[] = [
  { value: 'auto', label: 'Auto', icon: '🌗' },
  { value: 'day', label: 'Day', icon: '☀️' },
  { value: 'night', label: 'Night', icon: '🌙' },
];
const TEXT: readonly SegmentOption<Settings['textSize']>[] = [
  { value: 'big', label: 'Big', icon: <span className="aa-big">Aa</span> },
  { value: 'bigger', label: 'Bigger', icon: <span className="aa-bigger">Aa</span> },
];
const SOUND: readonly SegmentOption<'off' | 'on'>[] = [
  { value: 'off', label: 'Off', icon: '🔇' },
  { value: 'on', label: 'On', icon: '🔊' },
];

/** Two-note chime (G5 → C6), only when Sounds is On (§15.9). */
function chime() {
  try {
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [
      [784, 0],
      [1047, 0.14],
    ].forEach(([f = 784, t = 0]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      const at = ctx.currentTime + t;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.18, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.45);
      o.start(at);
      o.stop(at + 0.5);
    });
    window.setTimeout(() => void ctx.close(), 900);
  } catch {
    /* no audio: fine */
  }
}

/** Me (§15.1): world, night colours, text size, sounds. Saved on the device through the settings store. */
export function MeScreen() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const navigate = useNavigate();
  const [grownUps, setGrownUps] = useState(false);
  const isSpace = settings.world === 'space';

  return (
    <Screen labelledBy="me-h">
      <TaraSays small>
        <h1 className="greet" id="me-h" tabIndex={-1}>
          Make it yours! ✨
        </h1>
        <p>Pick a world for your adventure.</p>
      </TaraSays>

      <Card aria-labelledby="world-h">
        <h2 id="world-h">Pick your world</h2>
        <WorldPicker
          value={settings.world}
          onChange={(world) => void update({ world })}
          labelledBy="world-h"
        />
      </Card>

      <Card aria-label="How your app looks and sounds">
        <SegmentedControl
          label="Night colours"
          options={NIGHT}
          value={settings.night}
          onChange={(night) => void update({ night })}
          note={isSpace ? 'Space is always cosy and dark 🌌' : undefined}
        />
        <SegmentedControl
          label="Text size"
          options={TEXT}
          value={settings.textSize}
          onChange={(textSize) => void update({ textSize })}
        />
        <SegmentedControl
          label="Sounds"
          options={SOUND}
          value={settings.sound ? 'on' : 'off'}
          onChange={(v) => {
            void update({ sound: v === 'on' });
            if (v === 'on') chime();
          }}
        />
      </Card>

      <ChunkyButton variant="soft" onClick={() => setGrownUps(true)}>
        <span aria-hidden="true">🔒</span> Grown-ups only
      </ChunkyButton>

      <BottomSheet
        open={grownUps}
        icon="🔒"
        title="Grown-ups only"
        body="Ask Amma or Appa to open this part."
        primary={{ label: 'OK', onClick: () => setGrownUps(false) }}
        secondary={{ label: 'I’m a grown-up', onClick: () => navigate('/parent') }}
        onDismiss={() => setGrownUps(false)}
      />
    </Screen>
  );
}
