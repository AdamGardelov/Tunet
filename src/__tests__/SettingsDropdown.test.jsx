import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SettingsDropdown from '../components/ui/SettingsDropdown';

const translations = {
  'menu.settings': 'Settings',
  'menu.edit': 'Edit',
  'menu.system': 'System',
  'nav.addCard': 'Add card',
  'nav.done': 'Done',
  'settings.openAppearance': 'Open appearance',
  'settings.openLayout': 'Open layout',
  'settings.openHeader': 'Open header',
  'settings.openSystem': 'Open system',
  'system.tabAppearance': 'Appearance',
  'system.tabLayout': 'Layout',
  'system.tabHeader': 'Header',
};

const baseProps = (overrides = {}) => ({
  onOpenSettings: vi.fn(),
  onOpenTheme: vi.fn(),
  onOpenLayout: vi.fn(),
  onOpenHeader: vi.fn(),
  onAddCard: vi.fn(),
  onToggleEdit: vi.fn(),
  editMode: false,
  isMobile: true,
  floating: true,
  t: (key) => translations[key] || key,
  ...overrides,
});

describe('SettingsDropdown mobile action menu', () => {
  it('opens upward and exposes add-card and edit actions', () => {
    const props = baseProps();
    render(<SettingsDropdown {...props} />);

    const trigger = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('settings-dropdown-menu').className).toContain('bottom-full');
    expect(screen.getByRole('menuitem', { name: 'Add card' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Add card' }));

    expect(props.onAddCard).toHaveBeenCalledOnce();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('turns the floating trigger into Done while editing', () => {
    const props = baseProps({ editMode: true });
    render(<SettingsDropdown {...props} />);

    const doneButton = screen.getByRole('button', { name: 'Done' });
    expect(doneButton).not.toHaveAttribute('aria-expanded');
    expect(doneButton).toHaveClass('rounded-2xl');

    fireEvent.click(doneButton);

    expect(props.onToggleEdit).toHaveBeenCalledOnce();
    expect(screen.getByTestId('settings-dropdown-menu')).toHaveAttribute('aria-hidden', 'true');
  });
});
