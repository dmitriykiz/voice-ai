import { FC } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import { YellowNoticeBlock } from '@/app/components/container/message/notice-block';

export const DocNoticeBlock: FC<{
  children: React.ReactNode;
  docUrl: string;
  linkText?: string;
}> = ({ children, docUrl, linkText = 'Read documentation' }) => (
  <YellowNoticeBlock className="flex items-center gap-3">
    <Info className="shrink-0 w-4 h-4" strokeWidth={1.5} />
    <div className="text-sm font-medium flex-1">{children}</div>
    <a
      target="_blank"
      href={docUrl}
      className="ml-auto flex items-center gap-1.5 text-sm font-medium text-yellow-700 hover:underline whitespace-nowrap shrink-0"
      rel="noreferrer"
    >
      {linkText}
      <ExternalLink className="shrink-0 w-3.5 h-3.5" strokeWidth={1.5} />
    </a>
  </YellowNoticeBlock>
);
