/** Semantic colour for a displayed number. */
export type Tone = 'pos' | 'neg' | 'yel' | 'neu' | 'proj';

/**
 * Literal class names (not built with a template string) so Tailwind's
 * scanner sees them and emits the CSS.
 */
const TONE_CLASS: Record<Tone, string> = {
  pos: 'text-green',
  neg: 'text-red',
  yel: 'text-yellow',
  neu: 'text-text',
  proj: 'text-proj',
};

export const toneClass = (tone: Tone): string => TONE_CLASS[tone];

/** Green when non-negative, red otherwise. */
export const signTone = (v: number): Tone => (v >= 0 ? 'pos' : 'neg');
