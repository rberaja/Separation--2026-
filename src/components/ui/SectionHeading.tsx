import type { ReactNode } from 'react';

/** "A. Properties"-style heading: serif title, hairline rule, optional trailing control. */
export function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-[11px]">
      <h2 className="font-serif text-[0.9rem] font-medium text-text whitespace-nowrap">{children}</h2>
      <div className="flex-1 h-[1.5px] bg-border" />
      {action}
    </div>
  );
}
