import { SessionHeaderVariantA, SessionHeaderVariantB } from './sessionHeaderVariants';
import type { CanvasDemo } from './types';

export const canvasDemos: CanvasDemo[] = [
  {
    id: 'session-header',
    label: 'SessionHeader',
    description: 'Compare overview header + toggle layouts.',
    requiresSessionData: true,
    variants: [
      {
        id: 'a',
        label: 'Variant A',
        Component: SessionHeaderVariantA,
      },
      {
        id: 'b',
        label: 'Variant B',
        Component: SessionHeaderVariantB,
      },
    ],
  },
];
