import { KnowledgeConnect } from '@rapidaai/react';
import { FC } from 'react';
import { PageLoader } from '@/app/components/loader/page-loader';
import { useOAuthCallback } from '@/hooks/use-oauth-callback';

export const ConnectNotionKnowledgePage: FC = () => {
  useOAuthCallback(
    KnowledgeConnect,
    'notion',
    'Unable to connect notion, please try again later.',
  );
  return <PageLoader />;
};
