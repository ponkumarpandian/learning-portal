import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'div' | 'article';
  children: ReactNode;
}

/** --surface, 26px corners, 6px solid --ledge bottom edge. No grey drop shadows anywhere (§15.6). */
export function Card({ as: Tag = 'section', className, children, ...rest }: CardProps) {
  return (
    <Tag className={['card', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  );
}
