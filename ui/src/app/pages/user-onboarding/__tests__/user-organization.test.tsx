import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { CreateOrganizationPage } from '@/app/pages/user-onboarding/user-organization';
import { AuthContext } from '@/context/auth-context';
import { CreateOrganization } from '@rapidaai/react';

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
  CreateOrganization: jest.fn(),
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
}));

jest.mock('@/app/components/carbon/button', () => ({
  PrimaryButton: ({ children, isLoading, renderIcon, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/app/components/carbon/notification', () => ({
  Notification: ({ subtitle }: any) => <div>{subtitle}</div>,
}));

jest.mock('@carbon/react', () => ({
  Select: require('react').forwardRef(
    ({ labelText, helperText, children, ...props }: any, ref: any) => (
      <select ref={ref} {...props}>
        {children}
      </select>
    ),
  ),
  SelectItem: ({ value, text }: any) => <option value={value}>{text}</option>,
}));

const renderWithAuth = (authorize = jest.fn()) =>
  render(
    <AuthContext.Provider value={{ authorize } as any}>
      <CreateOrganizationPage />
    </AuthContext.Provider>,
  );

describe('CreateOrganizationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCredential = {
      user: { name: 'John' },
      authId: 'auth-1',
      token: 'token-1',
    };
  });

  it('shows validation error when required industry is missing', async () => {
    renderWithAuth();

    fireEvent.change(screen.getByPlaceholderText('eg: Lexatic Inc'), {
      target: { value: 'My Org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Please provide an industry.')).toBeInTheDocument();
    expect(CreateOrganization).not.toHaveBeenCalled();
  });

  it('submits and navigates to onboarding project on success', async () => {
    const authorize = jest.fn(success => success());
    (CreateOrganization as jest.Mock).mockImplementation(
      (_cfg, _name, _size, _industry, _headers, callback) => {
        callback(null, { getSuccess: () => true });
      },
    );

    renderWithAuth(authorize);

    fireEvent.change(screen.getByPlaceholderText('eg: Lexatic Inc'), {
      target: { value: 'My Org' },
    });
    fireEvent.change(screen.getByPlaceholderText('eg: Software, Healthcare, Finance'), {
      target: { value: 'Software' },
    });
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'startup' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(CreateOrganization).toHaveBeenCalled();
    });

    expect(mockShowLoader).toHaveBeenCalledWith('overlay');
    expect(authorize).toHaveBeenCalled();
    expect(mockHideLoader).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/onboarding/project');
  });

  it('shows generic error when API returns service error', async () => {
    (CreateOrganization as jest.Mock).mockImplementation(
      (_cfg, _name, _size, _industry, _headers, callback) => {
        callback(new Error('boom'), null);
      },
    );

    renderWithAuth();

    fireEvent.change(screen.getByPlaceholderText('eg: Lexatic Inc'), {
      target: { value: 'My Org' },
    });
    fireEvent.change(screen.getByPlaceholderText('eg: Software, Healthcare, Finance'), {
      target: { value: 'Software' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText('Unable to process your request. Please try again later.'),
    ).toBeInTheDocument();
  });

  it('shows credential error when API returns unsuccessful response', async () => {
    (CreateOrganization as jest.Mock).mockImplementation(
      (_cfg, _name, _size, _industry, _headers, callback) => {
        callback(null, { getSuccess: () => false });
      },
    );

    renderWithAuth();

    fireEvent.change(screen.getByPlaceholderText('eg: Lexatic Inc'), {
      target: { value: 'My Org' },
    });
    fireEvent.change(screen.getByPlaceholderText('eg: Software, Healthcare, Finance'), {
      target: { value: 'Software' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Please provide valid credentials to sign in.')).toBeInTheDocument();
  });
});
