import React from 'react';
import '@testing-library/jest-dom';

const mockLazyLoad = jest.fn(() => () => null);

jest.mock('@/utils/loadable', () => ({
  lazyLoad: (...args: any[]) => mockLazyLoad(...args),
}));

jest.mock('@/app/components/loader/page-loader', () => ({
  PageLoader: () => <div data-testid="page-loader" />,
}));

describe('user-onboarding/index lazy wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('registers organization and project onboarding pages via lazyLoad', async () => {
    await import('@/app/pages/user-onboarding');

    expect(mockLazyLoad).toHaveBeenCalledTimes(2);

    const calls = mockLazyLoad.mock.calls;
    const importers = calls.map(call => call[0] as () => Promise<unknown>);
    const selectors = calls.map(call => call[1] as (module: any) => any);

    expect(importers[0].toString()).toContain('./user-organization');
    expect(importers[1].toString()).toContain('./user-project');

    expect(selectors[0]({ CreateOrganizationPage: 'org' })).toBe('org');
    expect(selectors[1]({ CreateProjectPage: 'project' })).toBe('project');

    for (const call of calls) {
      expect(call[2]).toEqual(
        expect.objectContaining({
          fallback: expect.anything(),
        }),
      );
    }
  });
});
