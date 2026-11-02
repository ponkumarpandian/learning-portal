import type { WorldId } from '@/db/repos/settings';
import type { ResolvedTheme } from '@/state/settingsStore';

const Cloud = ({ className, opacity }: { className: string; opacity: number }) => (
  <svg className={className} viewBox="0 0 200 90" opacity={opacity}>
    <path
      d="M30 80 h140 a28 28 0 0 0 0 -56 a40 40 0 0 0 -72 -8 a30 30 0 0 0 -50 22 a22 22 0 0 0 -18 42 z"
      fill="var(--deco2)"
    />
  </svg>
);

const NIGHT_STARS: ReadonlyArray<[number, number, number]> = [
  [40, 60, 1.6],
  [120, 30, 1.2],
  [210, 90, 1.8],
  [300, 200, 1.3],
  [30, 260, 1.5],
  [370, 330, 1.4],
  [80, 480, 1.2],
  [350, 560, 1.7],
  [20, 700, 1.3],
  [380, 800, 1.5],
];
const SPACE_STARS: ReadonlyArray<[number, number, number]> = [
  [30, 40, 1.6],
  [90, 120, 1.1],
  [160, 30, 1.4],
  [230, 80, 1],
  [20, 200, 1.3],
  [380, 230, 1.7],
  [330, 300, 1],
  [60, 330, 1.8],
  [200, 380, 1],
  [370, 420, 1.3],
  [15, 470, 1.1],
  [110, 520, 1.5],
  [390, 560, 1.2],
  [40, 620, 1.6],
  [300, 650, 1],
  [370, 720, 1.8],
  [20, 780, 1.2],
  [160, 840, 1.4],
  [350, 870, 1.1],
];
const sparkle = (x: number, y: number, s: number) =>
  `M${x} ${y} l${s} ${2.6 * s} ${2.6 * s} ${s} -${2.6 * s} ${s} -${s} ${2.6 * s} -${s} -${2.6 * s} -${2.6 * s} -${s} ${2.6 * s} -${s}z`;

function Stars({ dots, sparkles }: { dots: ReadonlyArray<[number, number, number]>; sparkles?: boolean }) {
  return (
    <svg className="d-stars" viewBox="0 0 400 900" preserveAspectRatio="xMidYMid slice">
      <g fill="var(--deco)">
        {dots.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
        ))}
      </g>
      {sparkles && (
        <g fill="var(--deco)" opacity=".9">
          <path d={sparkle(60, 250, 3)} />
          <path d={sparkle(350, 140, 2.4)} />
          <path d={sparkle(28, 560, 2.4)} />
          <path d={sparkle(372, 640, 3)} />
        </g>
      )}
    </svg>
  );
}

/**
 * Fixed, static world decoration behind the content (§15.4): Meadow sun + clouds (moon + stars at
 * night), Ocean bubbles + a wave line, Space stars + a ringed planet. Never animates on its own.
 */
export function WorldDecor({ world, theme }: { world: WorldId; theme: ResolvedTheme }) {
  return (
    <div className="deco" aria-hidden="true" data-deco={world}>
      {world === 'meadow' && (
        <>
          {theme === 'dark' ? (
            <>
              <svg className="d-sun" viewBox="0 0 190 190">
                <defs>
                  <mask id="aa-moonmask">
                    <rect width="190" height="190" fill="#fff" />
                    <circle cx="112" cy="80" r="40" fill="#000" />
                  </mask>
                </defs>
                <circle cx="95" cy="95" r="70" fill="var(--deco)" opacity=".08" />
                <circle cx="92" cy="98" r="42" fill="var(--deco)" mask="url(#aa-moonmask)" />
              </svg>
              <Stars dots={NIGHT_STARS} />
            </>
          ) : (
            <svg className="d-sun" viewBox="0 0 190 190">
              <circle cx="95" cy="95" r="82" fill="var(--deco)" opacity=".22" />
              <circle cx="95" cy="95" r="62" fill="var(--deco)" opacity=".35" />
              <circle cx="95" cy="95" r="46" fill="var(--deco)" />
            </svg>
          )}
          <Cloud className="d-cloud1" opacity={0.9} />
          <Cloud className="d-cloud2" opacity={0.75} />
          <Cloud className="d-cloud3" opacity={0.7} />
        </>
      )}
      {world === 'ocean' && (
        <>
          <svg className="d-wave" viewBox="0 0 400 40" preserveAspectRatio="none">
            <path
              d="M0 20 Q25 4 50 20 T100 20 T150 20 T200 20 T250 20 T300 20 T350 20 T400 20"
              fill="none"
              stroke="var(--deco2)"
              strokeWidth="5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity=".7"
            />
            <path
              d="M0 32 Q25 18 50 32 T100 32 T150 32 T200 32 T250 32 T300 32 T350 32 T400 32"
              fill="none"
              stroke="var(--deco2)"
              strokeWidth="3"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity=".35"
            />
          </svg>
          <svg className="d-bubbles" viewBox="0 0 160 520">
            <g fill="var(--deco)" fillOpacity=".22" stroke="var(--deco)" strokeWidth="3" strokeOpacity=".85">
              <circle cx="120" cy="40" r="22" />
              <circle cx="80" cy="90" r="10" />
              <circle cx="130" cy="130" r="14" />
              <circle cx="100" cy="300" r="8" />
              <circle cx="135" cy="360" r="18" />
              <circle cx="110" cy="440" r="11" />
            </g>
            <g fill="var(--deco)" opacity=".9">
              <circle cx="114" cy="32" r="5" />
              <circle cx="129" cy="352" r="4" />
            </g>
          </svg>
          <svg className="d-bubbles2" viewBox="0 0 90 300">
            <g fill="var(--deco)" fillOpacity=".22" stroke="var(--deco)" strokeWidth="3" strokeOpacity=".8">
              <circle cx="30" cy="40" r="16" />
              <circle cx="55" cy="110" r="8" />
              <circle cx="25" cy="200" r="12" />
            </g>
          </svg>
        </>
      )}
      {world === 'space' && (
        <>
          <Stars dots={SPACE_STARS} sparkles />
          <svg className="d-planet" viewBox="0 0 170 150">
            <ellipse
              cx="88"
              cy="78"
              rx="74"
              ry="20"
              fill="none"
              stroke="var(--go)"
              strokeWidth="7"
              transform="rotate(-18 88 78)"
              opacity=".9"
            />
            <circle cx="88" cy="76" r="42" fill="var(--deco2)" />
            <circle cx="74" cy="62" r="9" fill="#fff" opacity=".18" />
            <circle cx="102" cy="92" r="6" fill="#000" opacity=".08" />
            <path
              d="M14 101 A74 20 -18 0 0 162 55"
              fill="none"
              stroke="var(--go)"
              strokeWidth="7"
              strokeLinecap="round"
              opacity=".95"
            />
          </svg>
        </>
      )}
    </div>
  );
}
