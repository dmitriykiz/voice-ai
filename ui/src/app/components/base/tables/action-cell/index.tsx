import React, { FC } from 'react';
import { TableCell } from '@/app/components/base/tables/table-cell';

export const ActionCell: FC<{ children: React.ReactNode }> = ({ children }) => {
  const childArray = React.Children.toArray(children).filter(Boolean);
  return (
    <TableCell>
      <div className="flex border border-gray-200 dark:border-gray-800 w-fit">
        {childArray.map((child, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <span className="w-px self-stretch bg-gray-200 dark:bg-gray-800 shrink-0" />
            )}
            {child}
          </React.Fragment>
        ))}
      </div>
    </TableCell>
  );
};
