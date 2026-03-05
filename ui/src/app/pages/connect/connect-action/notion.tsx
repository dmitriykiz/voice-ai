import { ActionConnect } from '@rapidaai/react';
import { FC } from 'react';
import { PageLoader } from '@/app/components/loader/page-loader';
import { useOAuthCallback } from '@/hooks/use-oauth-callback';

export const ConnectNotionActionPage: FC = () => {
  useOAuthCallback(
    ActionConnect,
    'notion',
    'Unable to connect notion, please try again later.',
  );
  return <PageLoader />;
};
