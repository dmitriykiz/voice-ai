import { FC } from 'react';

export const SectionDivider: FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3">
    <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-500 dark:text-gray-400 whitespace-nowrap">
      {label}
    </span>
    <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
  </div>
);
