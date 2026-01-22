import type { ComponentType } from 'react';
import type { SessionDetails, SessionFileEntry, Turn } from '../types';

export interface CanvasContext {
  activeSession: SessionFileEntry | null;
  sessionDetails: SessionDetails;
  sessionsRoot: string;
  turns: Turn[];
  hasSessionData: boolean;
}

export interface CanvasDemoVariant {
  id: string;
  label: string;
  description?: string;
  Component: ComponentType<{ context: CanvasContext }>;
}

export interface CanvasDemo {
  id: string;
  label: string;
  description?: string;
  requiresSessionData?: boolean;
  variants: CanvasDemoVariant[];
}
