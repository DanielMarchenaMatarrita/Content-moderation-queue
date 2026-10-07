import {
  Gauge,
  List,
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
      { label: 'Dashboard', to: '/', icon: Gauge },
      { label: 'Orders', to: '/orders', icon: List },
    ],
  },
];

export const navigationItems = navigationSections.flatMap((section) => section.items);
