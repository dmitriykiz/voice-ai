import React, { FC } from 'react';

export const OverviewRow: FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex items-center justify-between h-12 px-4 gap-4">
    <span className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 shrink-0">
      {label}
    </span>
    <div className="flex items-center">{children}</div>
  </div>
);
