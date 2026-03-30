import React from 'react';
import '@testing-library/jest-dom';

const mockLazyLoad = jest.fn(() => () => null);

jest.mock('@/utils/loadable', () => ({
  lazyLoad: (...args: any[]) => mockLazyLoad(...args),
}));

jest.mock('@/app/components/loader/page-loader', () => ({
  PageLoader: () => <div data-testid="page-loader" />,
}));

describe('authentication/index lazy wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('registers all auth pages with lazyLoad and correct selectors', async () => {
    await import('@/app/pages/authentication');

    expect(mockLazyLoad).toHaveBeenCalledTimes(4);

    const calls = mockLazyLoad.mock.calls;
    const importers = calls.map(call => call[0] as () => Promise<unknown>);
    const selectors = calls.map(call => call[1] as (module: any) => any);

    expect(importers[0].toString()).toContain("./sign-up");
    expect(importers[1].toString()).toContain("./sign-in");
    expect(importers[2].toString()).toContain("./forgot-password");
    expect(importers[3].toString()).toContain("./change-password");

    expect(selectors[0]({ SignUpPage: 'signup' })).toBe('signup');
    expect(selectors[1]({ SignInPage: 'signin' })).toBe('signin');
    expect(selectors[2]({ ForgotPasswordPage: 'forgot' })).toBe('forgot');
    expect(selectors[3]({ ChangePasswordPage: 'change' })).toBe('change');

    for (const call of calls) {
      expect(call[2]).toEqual(
        expect.objectContaining({
          fallback: expect.anything(),
        }),
      );
    }
  });
});
