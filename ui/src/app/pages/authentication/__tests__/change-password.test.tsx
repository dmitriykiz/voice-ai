import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ChangePasswordPage } from '@/app/pages/authentication/change-password';
import { CreatePassword } from '@rapidaai/react';

const mockNavigate = jest.fn();
const mockShowLoader = jest.fn();
const mockHideLoader = jest.fn();

let mockParams: Record<string, string | undefined> = {};

jest.mock('@rapidaai/react', () => ({
  ConnectionConfig: class ConnectionConfig {
    constructor(_: unknown) {}
  },
  CreatePassword: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

jest.mock('@/hooks', () => ({
  useRapidaStore: () => ({
    loading: false,
    showLoader: mockShowLoader,
    hideLoader: mockHideLoader,
  }),
}));

jest.mock('@/app/components/helmet', () => ({
  Helmet: () => null,
}));

jest.mock('@/app/components/carbon/form', () => ({
  Stack: ({ children }: any) => <div>{children}</div>,
  TextInput: (props: any) => <input {...props} />,
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
  PasswordInput: require('react').forwardRef(
    ({ labelText, ...props }: any, ref: any) => <input ref={ref} {...props} />,
  ),
}));

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
  });

  it('shows token expiry error when token is missing', async () => {
    render(<ChangePasswordPage />);

    fireEvent.change(screen.getAllByPlaceholderText('********')[0], {
      target: { value: 'secret' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('********')[1], {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    expect(
      await screen.findByText(
        'The password token is expired, please request again for reset password token.',
      ),
    ).toBeInTheDocument();
    expect(CreatePassword).not.toHaveBeenCalled();
    expect(mockShowLoader).not.toHaveBeenCalled();
  });

  it('shows mismatch error when passwords do not match', async () => {
    mockParams = { token: 'token-1' };
    render(<ChangePasswordPage />);

    fireEvent.change(screen.getAllByPlaceholderText('********')[0], {
      target: { value: 'secret-1' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('********')[1], {
      target: { value: 'secret-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    expect(
      await screen.findByText('Passwords entered do not match, please check and try again.'),
    ).toBeInTheDocument();
    expect(CreatePassword).not.toHaveBeenCalled();
  });

  it('submits and navigates to sign in on success', async () => {
    mockParams = { token: 'token-1' };
    (CreatePassword as jest.Mock).mockImplementation(
      (_cfg, _token, _password, callback) => {
        callback(null, { getSuccess: () => true });
      },
    );

    render(<ChangePasswordPage />);

    fireEvent.change(screen.getAllByPlaceholderText('********')[0], {
      target: { value: 'secret' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('********')[1], {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(CreatePassword).toHaveBeenCalled();
    });
    expect(mockShowLoader).toHaveBeenCalled();
    expect(mockHideLoader).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/auth/signin');
  });

  it('shows fallback error when API callback returns service error', async () => {
    mockParams = { token: 'token-1' };
    (CreatePassword as jest.Mock).mockImplementation(
      (_cfg, _token, _password, callback) => {
        callback(new Error('boom'), null);
      },
    );

    render(<ChangePasswordPage />);

    fireEvent.change(screen.getAllByPlaceholderText('********')[0], {
      target: { value: 'secret' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('********')[1], {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    expect(
      await screen.findByText('Unable to process your request. Please try again later.'),
    ).toBeInTheDocument();
    expect(mockHideLoader).toHaveBeenCalled();
  });

  it('shows human message when API returns unsuccessful response with error', async () => {
    mockParams = { token: 'token-1' };
    (CreatePassword as jest.Mock).mockImplementation(
      (_cfg, _token, _password, callback) => {
        callback(null, {
          getSuccess: () => false,
          getError: () => ({ getHumanmessage: () => 'Token invalid' }),
        });
      },
    );

    render(<ChangePasswordPage />);

    fireEvent.change(screen.getAllByPlaceholderText('********')[0], {
      target: { value: 'secret' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('********')[1], {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    expect(await screen.findByText('Token invalid')).toBeInTheDocument();
  });

  it('shows fallback error when API returns unsuccessful response without error details', async () => {
    mockParams = { token: 'token-1' };
    (CreatePassword as jest.Mock).mockImplementation(
      (_cfg, _token, _password, callback) => {
        callback(null, {
          getSuccess: () => false,
          getError: () => null,
        });
      },
    );

    render(<ChangePasswordPage />);

    fireEvent.change(screen.getAllByPlaceholderText('********')[0], {
      target: { value: 'secret' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('********')[1], {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    expect(
      await screen.findByText('Unable to process your request. Please try again later.'),
    ).toBeInTheDocument();
  });
});
