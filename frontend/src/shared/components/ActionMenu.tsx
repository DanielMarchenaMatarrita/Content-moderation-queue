import type { ReactNode } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { DotsThree } from '@phosphor-icons/react';
import { IconButton } from './IconButton';

export interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
}

export function ActionMenu({
  label = 'Open actions',
  items,
}: {
  label?: string;
  items: ActionMenuItem[];
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton label={label}>
          <DotsThree size={20} weight="bold" aria-hidden="true" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="dropdown-content" align="end" sideOffset={6}>
          {items.map((item) => (
            <DropdownMenu.Item key={item.label} onSelect={item.onSelect}>
              {item.icon}
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
