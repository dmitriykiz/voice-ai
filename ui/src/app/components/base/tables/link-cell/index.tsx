import { FC } from 'react';
import { ExternalLink } from 'lucide-react';
import { TableCell } from '@/app/components/base/tables/table-cell';
import { CustomLink } from '@/app/components/custom-link';

const linkClassName =
  'font-normal dark:text-blue-500 text-blue-600 hover:underline cursor-pointer text-left flex items-center space-x-1';

export const LinkCell: FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <TableCell>
    <CustomLink to={to} className={linkClassName}>
      <span>{children}</span>
      <ExternalLink className="w-3 h-3" />
    </CustomLink>
  </TableCell>
);

export const EntityLink: FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <CustomLink to={to} className={linkClassName}>
    <span>{children}</span>
    <ExternalLink className="w-3 h-3" />
  </CustomLink>
);
