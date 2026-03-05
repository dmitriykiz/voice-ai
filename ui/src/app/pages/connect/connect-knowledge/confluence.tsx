import { KnowledgeConnect } from '@rapidaai/react';
import { FC } from 'react';
import { PageLoader } from '@/app/components/loader/page-loader';
import { useOAuthCallback } from '@/hooks/use-oauth-callback';

export const ConnectConfluencePage: FC = () => {
  useOAuthCallback(
    KnowledgeConnect,
    'atlassian',
    'Unable to connect confluence, please try again later.',
  );
  return <PageLoader />;
};
