import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../layout/AppShell';
import { DashboardPage } from '../../pages/DashboardPage';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { CreateOrderPage } from '../../pages/CreateOrderPage';
import { OrderDetailPage } from '../../pages/OrderDetailPage';
import { OrdersPage } from '../../pages/OrdersPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'orders/new', element: <CreateOrderPage /> },
      { path: 'orders/:id', element: <OrderDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
