/** 112px gold medal with a kolam dotted inner ring and two ribbon tails. */
export function LevelMedal({ level }: { level: number }) {
  return (
    <div className="medal" role="img" aria-label={`Level ${level} medal`}>
      <div className="medal-face">
        <b aria-hidden="true">{level}</b>
      </div>
    </div>
  );
}
