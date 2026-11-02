import { NARRATION_RATE, browserNarrator, pickVoice, splitSentences } from './speech';

describe('splitSentences', () => {
  it.each([
    ['Light travels. It is straight!', ['Light travels.', 'It is straight!']],
    ['Is it?  Yes —   it is.', ['Is it?', 'Yes — it is.']],
    ['No full stop', ['No full stop']],
    ['Solids, liquids and gases… Let us see.', ['Solids, liquids and gases…', 'Let us see.']],
  ])('%s', (text, out) => {
    expect(splitSentences(text)).toEqual(out);
  });
});

describe('pickVoice', () => {
  const v = (lang: string, name = lang, localService = true) => ({ lang, name, localService });
  it('prefers en-IN, then any English, else none', () => {
    expect(pickVoice([v('en-US'), v('en_IN', 'Heera'), v('hi-IN')])?.name).toBe('Heera');
    expect(pickVoice([v('fr-FR'), v('en-GB', 'remote', false), v('en-US', 'local')])?.name).toBe('local');
    expect(pickVoice([v('fr-FR'), v('hi-IN')])).toBeUndefined();
  });
});

class FakeUtterance {
  text: string;
  voice: unknown = null;
  lang = '';
  rate = 1;
  pitch = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onboundary: ((e: { charIndex: number }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

function fakeSynth(voices: { lang: string; name: string }[]) {
  const listeners: (() => void)[] = [];
  const spoken: FakeUtterance[] = [];
  const synth = {
    voices,
    getVoices: () => synth.voices,
    speak: (u: FakeUtterance) => spoken.push(u),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    addEventListener: (_: string, cb: () => void) => listeners.push(cb),
    removeEventListener: () => {},
  };
  return { synth, spoken, fire: () => listeners.forEach((cb) => cb()) };
}

describe('browserNarrator', () => {
  it('is captions-only without the API', () => {
    expect(browserNarrator(undefined, undefined).available).toBe(false);
  });

  it('becomes available when voices load late (voiceschanged)', () => {
    const f = fakeSynth([]);
    const n = browserNarrator(f.synth as never, FakeUtterance as never);
    const changed = vi.fn();
    n.onChange?.(changed);
    expect(n.available).toBe(false);
    f.synth.voices = [{ lang: 'en-IN', name: 'Heera' }];
    f.fire();
    expect(n.available).toBe(true);
    expect(changed).toHaveBeenCalled();
  });

  it('speaks at 0.95 × speed and reports the end once; cancel detaches the callbacks', () => {
    const f = fakeSynth([{ lang: 'en-IN', name: 'Heera' }]);
    const n = browserNarrator(f.synth as never, FakeUtterance as never);
    const onEnd = vi.fn();
    n.speak('Hello there.', { rate: 1.25, onEnd });
    const u = f.spoken[0]!;
    expect(u.rate).toBeCloseTo(NARRATION_RATE * 1.25);
    expect(u.lang).toBe('en-IN');
    u.onend?.();
    u.onend?.();
    expect(onEnd).toHaveBeenCalledTimes(1);

    const onEnd2 = vi.fn();
    n.speak('Second.', { rate: 1, onEnd: onEnd2 });
    const u2 = f.spoken[1]!;
    n.cancel();
    expect(u2.onend).toBeNull();
    expect(onEnd2).not.toHaveBeenCalled();
  });

  it('without a voice, speak() ends at once so captions carry on', () => {
    const f = fakeSynth([{ lang: 'fr-FR', name: 'Amélie' }]);
    const n = browserNarrator(f.synth as never, FakeUtterance as never);
    const onEnd = vi.fn();
    n.speak('Bonjour.', { rate: 1, onEnd });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(f.spoken).toHaveLength(0);
  });
});
