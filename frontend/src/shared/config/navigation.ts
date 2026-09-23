import {
  Database,
  Files,
  Gauge,
  Pulse,
  Users,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

export interface NavigationItem {
  label: string;
  to: string;
  icon: Icon;
}

interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

export const navigationSections: NavigationSection[] = [
  {
    label: 'Product',
    items: [
      { label: 'Overview', to: '/', icon: Gauge },
      { label: 'Contents', to: '/contents', icon: Files },
      { label: 'Users', to: '/users', icon: Users },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Outbox events', to: '/system/outbox', icon: Database },
      {
        label: 'Processed messages',
        to: '/system/processed',
        icon: Pulse,
      },
    ],
  },
];

export const navigationItems = navigationSections.flatMap((section) => section.items);
