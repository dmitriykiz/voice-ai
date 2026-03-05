import { KnowledgeConnect } from '@rapidaai/react';
import { FC } from 'react';
import { PageLoader } from '@/app/components/loader/page-loader';
import { useOAuthCallback } from '@/hooks/use-oauth-callback';

export const ConnectSharePointKnowledgePage: FC = () => {
  useOAuthCallback(
    KnowledgeConnect,
    'share-point',
    'Unable to connect share-point, please try again later.',
  );
  return <PageLoader />;
};
