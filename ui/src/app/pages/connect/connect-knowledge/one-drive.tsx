import { KnowledgeConnect } from '@rapidaai/react';
import { FC } from 'react';
import { PageLoader } from '@/app/components/loader/page-loader';
import { useOAuthCallback } from '@/hooks/use-oauth-callback';

export const ConnectOneDriveKnowledgePage: FC = () => {
  useOAuthCallback(
    KnowledgeConnect,
    'one-drive',
    'Unable to connect one drive, please try again later.',
  );
  return <PageLoader />;
};
