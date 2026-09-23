import { useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Database,
  FilePlus,
  Plus,
  Pulse,
  UserPlus,
} from '@phosphor-icons/react';
import { IconButton } from '../../shared/components/IconButton';

const actions = [
  { label: 'Submit content', to: '/contents/new', icon: FilePlus },
  { label: 'Create user', to: '/users/new', icon: UserPlus },
] as const;

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton label="Open quick actions">
          <Plus size={19} weight="bold" aria-hidden="true" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="dropdown-content" align="end" sideOffset={8}>
          <DropdownMenu.Label>Quick actions</DropdownMenu.Label>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <DropdownMenu.Item key={action.to} onSelect={() => navigate(action.to)}>
                <Icon size={17} aria-hidden="true" />
                {action.label}
              </DropdownMenu.Item>
            );
          })}
          <DropdownMenu.Separator />
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>
              <Pulse size={17} aria-hidden="true" />
              View diagnostics
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="dropdown-content" sideOffset={6}>
                <DropdownMenu.Item onSelect={() => navigate('/system/outbox')}>
                  <Database size={17} aria-hidden="true" />
                  Outbox events
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => navigate('/system/processed')}>
                  <Pulse size={17} aria-hidden="true" />
                  Processed messages
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
