import {
  ChartDonut,
  ChartLine,
  Compass,
  Gauge,
  List,
  Network,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

export interface NavigationItem {
  label: string;
  to: string;
  icon: Icon;
  external?: boolean;
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
      { label: 'Architecture', to: '/architecture', icon: Network },
    ],
  },
  {
    label: 'Grafana',
    items: [
      { label: 'Application logs', to: import.meta.env.VITE_GRAFANA_LOGS_URL || 'http://localhost:3001/d/paygrid-logs', icon: ChartLine, external: true },
      { label: 'Explore', to: import.meta.env.VITE_GRAFANA_EXPLORE_URL || 'http://localhost:3001/explore', icon: Compass, external: true },
      { label: 'All dashboards', to: import.meta.env.VITE_GRAFANA_DASHBOARDS_URL || 'http://localhost:3001/dashboards', icon: ChartDonut, external: true },
    ],
  },
];

export const navigationItems = navigationSections.flatMap((section) => section.items).filter((item) => !item.external);
