import { KnowledgeConnect } from '@rapidaai/react';
import { FC } from 'react';
import { PageLoader } from '@/app/components/loader/page-loader';
import { useOAuthCallback } from '@/hooks/use-oauth-callback';

export const ConnectGoogleDriveKnowledgePage: FC = () => {
  useOAuthCallback(
    KnowledgeConnect,
    'google-drive',
    'Unable to connect google drive, please try again later.',
  );
  return <PageLoader />;
};
