import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCredential } from '@/hooks/use-credential';
import { useProviderContext } from '@/context/provider-context';
import { connectionConfig } from '@/configs';
import toast from 'react-hot-toast/headless';

type ConnectResponse = { getSuccess(): boolean; getRedirectto(): string };
type ConnectFn = (
  config: typeof connectionConfig,
  providerSlug: string,
  code: string,
  state: string,
  scope: string,
  headers: { authorization: string; 'x-project-id': string; 'x-auth-id': string },
  callback: (err: unknown, res: ConnectResponse | null) => void,
) => void;

/**
 * Handles the OAuth callback flow for connect-knowledge and connect-action pages.
 * Calls the given SDK connect function, then redirects on success or shows an error.
 */
export function useOAuthCallback(
  connectFn: ConnectFn,
  providerSlug: string,
  errorMessage: string,
) {
  const [searchParams] = useSearchParams();
  const { state, code, scope } = Object.fromEntries(searchParams.entries());
  const [userId, token, projectId] = useCredential();
  const providerCtx = useProviderContext();
  const navigate = useNavigate();

  const onComplete = useCallback(
    (err: unknown, res: ConnectResponse | null) => {
      if (res?.getSuccess()) {
        providerCtx.reloadToolCredentials();
        navigate(res.getRedirectto());
        return;
      }
      toast.error(errorMessage);
      navigate('/integration/tools');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    connectFn(
      connectionConfig,
      providerSlug,
      code,
      state,
      scope,
      { authorization: token, 'x-project-id': projectId, 'x-auth-id': userId },
      onComplete,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, code, scope]);
}
