import { ActionConnect } from '@rapidaai/react';
import { FC } from 'react';
import { PageLoader } from '@/app/components/loader/page-loader';
import { useOAuthCallback } from '@/hooks/use-oauth-callback';

export const ConnectGmailActionPage: FC = () => {
  useOAuthCallback(
    ActionConnect,
    'gmail',
    'Unable to connect gmail, please try again later.',
  );
  return <PageLoader />;
};
