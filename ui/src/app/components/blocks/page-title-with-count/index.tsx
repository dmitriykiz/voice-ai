import React, { FC } from 'react';
import { PageTitleBlock } from '@/app/components/blocks/page-title-block';

export const PageTitleWithCount: FC<{
  count: number;
  total: number;
  children: React.ReactNode;
}> = ({ count, total, children }) => (
  <div className="flex items-center gap-3">
    <PageTitleBlock>{children}</PageTitleBlock>
    <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
      {count}/{total}
    </span>
  </div>
);
