import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BottomSheet } from './BottomSheet';
import { Tara } from './Tara';

export interface FocusHeaderProps {
  eyebrow?: string;
  title: string;
  titleId?: string;
  /** What ✕ leaves: "lesson", "test"... */
  what?: string;
  leaveTo?: string;
}

/**
 * Top of a focus screen (§15.2): a 56px ✕ that asks "Leave the lesson? Your progress is saved." with
 * Keep going as the default (focused) choice.
 */
export function FocusHeader({ eyebrow, title, titleId, what = 'lesson', leaveTo = '/' }: FocusHeaderProps) {
  const [asking, setAsking] = useState(false);
  const navigate = useNavigate();
  return (
    <header className="focus-top">
      <button type="button" className="xbtn" aria-label={`Leave the ${what}`} onClick={() => setAsking(true)}>
        ✕
      </button>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 id={titleId} tabIndex={-1}>
          {title}
        </h1>
      </div>
      <BottomSheet
        open={asking}
        icon={<Tara size="fill" label={null} />}
        title={`Leave the ${what}?`}
        body="Your progress is saved."
        primary={{ label: 'Keep going', onClick: () => setAsking(false) }}
        secondary={{ label: 'Leave for now', onClick: () => navigate(leaveTo) }}
        onDismiss={() => setAsking(false)}
      />
    </header>
  );
}
