/** Semantic colour for a displayed number; maps to the `tone-*` utilities in global.css. */
export type Tone = 'pos' | 'neg' | 'yel' | 'neu' | 'proj';

export const toneClass = (tone: Tone): string => `tone-${tone}`;

/** Green when non-negative, red otherwise. */
export const signTone = (v: number): Tone => (v >= 0 ? 'pos' : 'neg');
