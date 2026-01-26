import { SessionHeaderVariantA, SessionHeaderVariantB } from './sessionHeaderVariants';
import { TokenCountVariantA, TokenCountVariantB } from './tokenCountVariants';
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
  {
    id: 'token-count',
    label: 'Token Count',
    description: 'Visualize token usage + rate limits.',
    requiresSessionData: true,
    variants: [
      {
        id: 'a',
        label: 'Variant A',
        Component: TokenCountVariantA,
      },
      {
        id: 'b',
        label: 'Variant B',
        Component: TokenCountVariantB,
      },
    ],
  },
];
