import { useId, type ReactNode } from 'react';
import type { WorldId } from '@/db/repos/settings';

interface WorldDef {
  id: WorldId;
  name: string;
  word: string;
  art: ReactNode;
}

/* Each preview shows that world's own sky + decoration, whatever world is active. */
const WORLDS: readonly WorldDef[] = [
  {
    id: 'meadow',
    name: 'Meadow',
    word: 'Sunny',
    art: (
      <svg viewBox="0 0 100 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <circle cx="82" cy="14" r="13" fill="#ffd23f" />
        <path
          d="M8 40 h36 a8 8 0 0 0 0 -16 a11 11 0 0 0 -20 -2 a8 8 0 0 0 -14 6 a6 6 0 0 0 -2 12z"
          fill="#fff"
        />
        <path d="M0 70 Q30 56 60 66 T100 62 V80 H0z" fill="#bfe3a0" />
        <text x="50" y="62" fontSize="20" textAnchor="middle">
          🌻
        </text>
      </svg>
    ),
  },
  {
    id: 'ocean',
    name: 'Ocean',
    word: 'Fresh',
    art: (
      <svg viewBox="0 0 100 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g fill="#fff" fillOpacity=".3" stroke="#fff" strokeWidth="2">
          <circle cx="80" cy="16" r="8" />
          <circle cx="68" cy="32" r="4" />
          <circle cx="18" cy="22" r="5" />
        </g>
        <path d="M0 46 Q12 38 25 46 T50 46 T75 46 T100 46" fill="none" stroke="#4cc3da" strokeWidth="3" />
        <path d="M0 70 Q30 60 60 68 T100 64 V80 H0z" fill="#ffe2ae" />
        <text x="50" y="66" fontSize="20" textAnchor="middle">
          🐠
        </text>
      </svg>
    ),
  },
  {
    id: 'space',
    name: 'Space',
    word: 'Cosy',
    art: (
      <svg viewBox="0 0 100 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g fill="#fff6c8">
          <circle cx="12" cy="12" r="1.2" />
          <circle cx="30" cy="30" r="1" />
          <circle cx="52" cy="10" r="1.4" />
          <circle cx="20" cy="52" r="1" />
          <circle cx="90" cy="50" r="1.2" />
        </g>
        <ellipse
          cx="78"
          cy="22"
          rx="20"
          ry="5"
          fill="none"
          stroke="#ffc93c"
          strokeWidth="2.5"
          transform="rotate(-18 78 22)"
        />
        <circle cx="78" cy="22" r="11" fill="#ff8fb1" />
        <text x="48" y="66" fontSize="20" textAnchor="middle">
          🚀
        </text>
      </svg>
    ),
  },
];

export interface WorldPickerProps {
  value: WorldId;
  onChange: (world: WorldId) => void;
  labelledBy: string;
}

/** Three world tiles backed by radios; switches live. Selected = 4px --go border + gold ✓. */
export function WorldPicker({ value, onChange, labelledBy }: WorldPickerProps) {
  const name = useId();
  return (
    <div className="worlds" role="radiogroup" aria-labelledby={labelledBy}>
      {WORLDS.map((w) => (
        <label className="world" key={w.id} data-world-option={w.id}>
          <input
            className="sr-only"
            type="radio"
            name={name}
            value={w.id}
            checked={value === w.id}
            onChange={() => onChange(w.id)}
          />
          <span className="w-prev" data-w={w.id}>
            {w.art}
          </span>
          {value === w.id && (
            <span className="tick w-tick" aria-hidden="true">
              ✓
            </span>
          )}
          <span>
            <b>{w.name}</b>
            <small>{w.word}</small>
          </span>
        </label>
      ))}
    </div>
  );
}
