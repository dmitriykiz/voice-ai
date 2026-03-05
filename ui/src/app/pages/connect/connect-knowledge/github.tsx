import { KnowledgeConnect } from '@rapidaai/react';
import { FC } from 'react';
import { PageLoader } from '@/app/components/loader/page-loader';
import { useOAuthCallback } from '@/hooks/use-oauth-callback';

export const ConnectGithubKnowledgePage: FC = () => {
  useOAuthCallback(
    KnowledgeConnect,
    'github',
    'Unable to connect github, please try again later.',
  );
  return <PageLoader />;
};
