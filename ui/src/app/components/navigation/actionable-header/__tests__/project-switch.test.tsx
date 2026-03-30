import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  ActionableHeader,
  CustomerOptions,
} from '@/app/components/navigation/actionable-header';
import { AuthContext } from '@/context/auth-context';

const mockToggleDarkMode = jest.fn();

let mockPathname = '/dashboard/assistant/list';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => ({ pathname: mockPathname }),
}));

jest.mock('@/context/dark-mode-context', () => ({
  useDarkMode: () => ({
    isDarkMode: false,
    toggleDarkMode: mockToggleDarkMode,
  }),
}));

jest.mock('@/app/components/custom-link', () => ({
  CustomLink: ({ to, children }: any) => <a href={to}>{children}</a>,
}));

jest.mock('@carbon/icons-react', () => ({
  Moon: () => <span>moon</span>,
  Sun: () => <span>sun</span>,
  UserAvatar: () => <span>avatar</span>,
}));

jest.mock('@carbon/react', () => ({
  Breadcrumb: ({ children }: any) => <ol>{children}</ol>,
  BreadcrumbItem: ({ children }: any) => <li>{children}</li>,
  HeaderGlobalBar: ({ children }: any) => <div>{children}</div>,
  HeaderGlobalAction: ({ children, tooltipAlignment, isActive, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  HeaderPanel: ({ children, expanded }: any) => (expanded ? <div>{children}</div> : null),
  Switcher: ({ children }: any) => <ul>{children}</ul>,
  SwitcherItem: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  Dropdown: ({
    id,
    label,
    items,
    selectedItem,
    itemToString,
    onChange,
  }: any) => {
    const selectedIndex = Math.max(items.findIndex((x: any) => x === selectedItem), 0);
    return (
      <select
        id={id}
        aria-label={label}
        data-testid={id}
        value={String(selectedIndex)}
        onChange={e => {
          const idx = Number(e.target.value);
          onChange({ selectedItem: items[idx] ?? null });
        }}
      >
        {items.map((item: any, idx: number) => (
          <option key={item.id || idx} value={String(idx)}>
            {itemToString(item)}
          </option>
        ))}
      </select>
    );
  },
}));

const projectRoles = [
  { id: 'r1', projectid: 'p1', projectname: 'Alpha' },
  { id: 'r2', projectid: 'p2', projectname: 'Beta' },
] as any;

describe('Actionable header project switcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard/assistant/list';
  });

  it('renders project dropdown in header and switches project on selection', () => {
    const setCurrentProjectRole = jest.fn();

    render(
      <AuthContext.Provider
        value={{
          projectRoles,
          currentProjectRole: projectRoles[0],
          setCurrentProjectRole,
        }}
      >
        <ActionableHeader />
      </AuthContext.Provider>,
    );

    const projectSelector = screen.getByLabelText('Select a Project');
    expect(projectSelector).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument();

    fireEvent.change(projectSelector, { target: { value: '1' } });
    expect(setCurrentProjectRole).toHaveBeenCalledWith(projectRoles[1]);
  });

  it('does not render project dropdown when setter is unavailable', () => {
    render(
      <AuthContext.Provider
        value={{
          projectRoles,
          currentProjectRole: projectRoles[0],
        }}
      >
        <CustomerOptions />
      </AuthContext.Provider>,
    );

    expect(screen.queryByLabelText('Select a Project')).not.toBeInTheDocument();
  });
});
