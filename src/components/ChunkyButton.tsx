import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Link, type LinkProps } from 'react-router';

export type ChunkyVariant = 'go' | 'soft';

const cls = (variant: ChunkyVariant, extra?: string) =>
  ['chunky', variant === 'soft' && 'soft', extra].filter(Boolean).join(' ');

export interface ChunkyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ChunkyVariant;
  /** Trailing ▶ arrow (decorative) */
  arrow?: boolean;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * The one big action per screen (§15.2, §15.6): solid --go fill, a 6px solid ledge, moves down 5px
 * when pressed. `soft` is for secondary actions. Disabled = 45% opacity.
 */
export function ChunkyButton({
  variant = 'go',
  arrow,
  className,
  children,
  type = 'button',
  ref,
  ...rest
}: ChunkyButtonProps) {
  return (
    <button ref={ref} type={type} className={cls(variant, className)} {...rest}>
      {children}
      {arrow && (
        <span className="arrow" aria-hidden="true">
          ▶
        </span>
      )}
    </button>
  );
}

export interface ChunkyLinkProps extends LinkProps {
  variant?: ChunkyVariant;
  arrow?: boolean;
}

/** Same look as ChunkyButton, for navigation ("Back to my trail"). */
export function ChunkyLink({ variant = 'go', arrow, className, children, ...rest }: ChunkyLinkProps) {
  return (
    <Link className={cls(variant, className)} {...rest}>
      {children}
      {arrow && (
        <span className="arrow" aria-hidden="true">
          ▶
        </span>
      )}
    </Link>
  );
}
