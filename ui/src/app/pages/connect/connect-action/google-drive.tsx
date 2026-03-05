import { ActionConnect } from '@rapidaai/react';
import { FC } from 'react';
import { PageLoader } from '@/app/components/loader/page-loader';
import { useOAuthCallback } from '@/hooks/use-oauth-callback';

export const ConnectGoogleDriveActionPage: FC = () => {
  useOAuthCallback(
    ActionConnect,
    'google-drive',
    'Unable to connect google drive, please try again later.',
  );
  return <PageLoader />;
};
