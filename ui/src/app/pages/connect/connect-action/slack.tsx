import { ActionConnect } from '@rapidaai/react';
import { FC } from 'react';
import { PageLoader } from '@/app/components/loader/page-loader';
import { useOAuthCallback } from '@/hooks/use-oauth-callback';

export const ConnectSlackActionPage: FC = () => {
  useOAuthCallback(
    ActionConnect,
    'slack',
    'Unable to connect slack, please try again later.',
  );
  return <PageLoader />;
};
