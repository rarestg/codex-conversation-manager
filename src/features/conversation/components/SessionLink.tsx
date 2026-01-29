import type { ReactNode } from 'react';
import { isPlainLeftClick } from '../link';

interface SessionLinkProps {
  href: string;
  onNavigate?: () => void;
  className?: string;
  ariaCurrent?: 'page' | 'true' | 'false';
  children: ReactNode;
}

export const SessionLink = ({ href, onNavigate, className, ariaCurrent, children }: SessionLinkProps) => (
  <a
    href={href}
    aria-current={ariaCurrent}
    onClick={(event) => {
      if (!isPlainLeftClick(event)) return;
      if (!onNavigate) return;
      event.preventDefault();
      onNavigate();
    }}
    className={className}
  >
    {children}
  </a>
);
