import type { FC, ReactNode } from 'react';
import {
  Dropdown as CarbonDropdown,
  DropdownSkeleton as CarbonDropdownSkeleton,
  MultiSelect as CarbonMultiSelect,
} from '@carbon/react';
import { cn } from '@/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type DropdownSize = 'sm' | 'md' | 'lg';
type DropdownDirection = 'top' | 'bottom';

// ─── Dropdown (single select) ────────────────────────────────────────────────

export interface CarbonDropdownProps<T> {
  id: string;
  titleText: ReactNode;
  label: string;
  items: T[];
  itemToString?: (item: T | null) => string;
  selectedItem?: T | null;
  initialSelectedItem?: T | null;
  onChange?: (data: { selectedItem: T | null }) => void;
  className?: string;
  size?: DropdownSize;
  direction?: DropdownDirection;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  invalidText?: ReactNode;
  warn?: boolean;
  warnText?: ReactNode;
  helperText?: ReactNode;
  hideLabel?: boolean;
  type?: 'default' | 'inline';
  isLoading?: boolean;
}

/** Carbon Dropdown — single-select dropdown list. */
export function Dropdown<T>({
  id,
  titleText,
  label,
  items,
  itemToString,
  selectedItem,
  initialSelectedItem,
  onChange,
  className,
  size = 'md',
  direction = 'bottom',
  disabled = false,
  readOnly = false,
  invalid = false,
  invalidText,
  warn = false,
  warnText,
  helperText,
  hideLabel = false,
  type = 'default',
  isLoading = false,
}: CarbonDropdownProps<T>) {
  if (isLoading) {
    return (
      <CarbonDropdownSkeleton
        size={size}
        hideLabel={hideLabel}
        className={cn(className)}
      />
    );
  }

  return (
    <CarbonDropdown
      id={id}
      titleText={titleText}
      label={label}
      items={items}
      itemToString={
        itemToString || ((item: T | null) => (item ? String(item) : ''))
      }
      selectedItem={selectedItem}
      initialSelectedItem={initialSelectedItem}
      onChange={onChange}
      className={cn(className)}
      size={size}
      direction={direction}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
      invalidText={invalidText}
      warn={warn}
      warnText={warnText}
      helperText={helperText}
      hideLabel={hideLabel}
      type={type}
    />
  );
}

// ─── MultiSelect ─────────────────────────────────────────────────────────────

export interface CarbonMultiSelectProps<T> {
  id: string;
  titleText: ReactNode;
  label: string;
  items: T[];
  itemToString?: (item: T) => string;
  selectedItems?: T[];
  initialSelectedItems?: T[];
  onChange?: (data: { selectedItems: T[] | null }) => void;
  className?: string;
  size?: DropdownSize;
  direction?: DropdownDirection;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  invalidText?: ReactNode;
  warn?: boolean;
  warnText?: ReactNode;
  helperText?: ReactNode;
  hideLabel?: boolean;
  type?: 'default' | 'inline';
  selectionFeedback?: 'fixed' | 'top' | 'top-after-reopen';
  clearSelectionText?: string;
  clearSelectionDescription?: string;
}

/** Carbon MultiSelect — multi-select dropdown with checkboxes. */
export function MultiSelect<T>({
  id,
  titleText,
  label,
  items,
  itemToString,
  selectedItems,
  initialSelectedItems,
  onChange,
  className,
  size = 'md',
  direction = 'bottom',
  disabled = false,
  readOnly = false,
  invalid = false,
  invalidText,
  warn = false,
  warnText,
  helperText,
  hideLabel = false,
  type = 'default',
  selectionFeedback = 'top-after-reopen',
  clearSelectionText = 'Clear all',
  clearSelectionDescription = 'Total items selected:',
}: CarbonMultiSelectProps<T>) {
  return (
    <CarbonMultiSelect
      id={id}
      titleText={titleText}
      label={label}
      items={items}
      itemToString={itemToString || ((item: T) => (item ? String(item) : ''))}
      selectedItems={selectedItems}
      initialSelectedItems={initialSelectedItems}
      onChange={onChange}
      className={cn(className)}
      size={size}
      direction={direction}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
      invalidText={invalidText}
      warn={warn}
      warnText={warnText}
      helperText={helperText}
      hideLabel={hideLabel}
      type={type}
      selectionFeedback={selectionFeedback}
      clearSelectionText={clearSelectionText}
      clearSelectionDescription={clearSelectionDescription}
    />
  );
}
