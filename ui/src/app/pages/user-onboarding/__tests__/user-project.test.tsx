import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { CreateProjectPage } from '@/app/pages/user-onboarding/user-project';
import { AuthContext } from '@/context/auth-context';
import { CreateProject } from '@rapidaai/react';

const mockNavigate = jest.fn();
const mockShowLoader = jest.fn();
const mockHideLoader = jest.fn();

let mockCredential = {
  user: { name: 'John' },
  authId: 'auth-1',
  token: 'token-1',
};

jest.mock('@rapidaai/react', () => ({
  ConnectionConfig: class ConnectionConfig {
    constructor(_: unknown) {}
  },
  CreateProject: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('@/hooks', () => ({
  useRapidaStore: () => ({
    loading: false,
    showLoader: mockShowLoader,
    hideLoader: mockHideLoader,
  }),
}));

jest.mock('@/hooks/use-credential', () => ({
  useCurrentCredential: () => mockCredential,
}));

jest.mock('@/app/components/helmet', () => ({
  Helmet: () => null,
}));

jest.mock('@/app/components/carbon/form', () => ({
  Stack: ({ children }: any) => <div>{children}</div>,
  TextInput: require('react').forwardRef(
    ({ labelText, helperText, ...props }: any, ref: any) => <input ref={ref} {...props} />,
  ),
  TextArea: require('react').forwardRef(
    ({ labelText, helperText, ...props }: any, ref: any) => <textarea ref={ref} {...props} />,
  ),
}));

jest.mock('@/app/components/carbon/button', () => ({
  PrimaryButton: ({ children, isLoading, renderIcon, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/app/components/carbon/notification', () => ({
  Notification: ({ subtitle }: any) => <div>{subtitle}</div>,
}));

const renderWithAuth = (authorize = jest.fn()) =>
  render(
    <AuthContext.Provider value={{ authorize } as any}>
      <CreateProjectPage />
    </AuthContext.Provider>,
  );

describe('CreateProjectPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCredential = {
      user: { name: 'John' },
      authId: 'auth-1',
      token: 'token-1',
    };
  });

  it('submits and navigates to dashboard on success', async () => {
    const authorize = jest.fn(success => success());
    (CreateProject as jest.Mock).mockImplementation(
      (_cfg, _name, _description, _headers, callback) => {
        callback(null, { getSuccess: () => true });
      },
    );

    renderWithAuth(authorize);

    fireEvent.change(screen.getByPlaceholderText('eg: Customer Support Bot'), {
      target: { value: 'Support Bot' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('eg: Voice assistant for handling customer inquiries 24/7'),
      { target: { value: 'Project description' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go to dashboard' }));

    await waitFor(() => {
      expect(CreateProject).toHaveBeenCalled();
    });

    expect(mockShowLoader).toHaveBeenCalledWith('overlay');
    expect(mockHideLoader).toHaveBeenCalled();
    expect(authorize).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('shows generic error when API returns service error', async () => {
    (CreateProject as jest.Mock).mockImplementation(
      (_cfg, _name, _description, _headers, callback) => {
        callback(new Error('boom'), null);
      },
    );

    renderWithAuth();

    fireEvent.change(screen.getByPlaceholderText('eg: Customer Support Bot'), {
      target: { value: 'Support Bot' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Go to dashboard' }));

    expect(
      await screen.findByText('Unable to process your request. Please try again later.'),
    ).toBeInTheDocument();
  });

  it('shows project details error when API returns unsuccessful response', async () => {
    (CreateProject as jest.Mock).mockImplementation(
      (_cfg, _name, _description, _headers, callback) => {
        callback(null, { getSuccess: () => false });
      },
    );

    renderWithAuth();

    fireEvent.change(screen.getByPlaceholderText('eg: Customer Support Bot'), {
      target: { value: 'Support Bot' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Go to dashboard' }));

    expect(
      await screen.findByText('Unable to create project. Please check the details.'),
    ).toBeInTheDocument();
  });
});
