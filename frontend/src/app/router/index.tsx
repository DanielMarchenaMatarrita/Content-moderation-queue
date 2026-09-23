import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../layout/AppShell';
import { ContentDetailPage } from '../../pages/ContentDetailPage';
import { ContentsPage } from '../../pages/ContentsPage';
import { CreateContentPage } from '../../pages/CreateContentPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { OutboxEventsPage } from '../../pages/OutboxEventsPage';
import { OutboxEventDetailPage } from '../../pages/OutboxEventDetailPage';
import { ProcessedMessagesPage } from '../../pages/ProcessedMessagesPage';
import { ProcessedMessageDetailPage } from '../../pages/ProcessedMessageDetailPage';
import { CreateUserPage } from '../../pages/CreateUserPage';
import { UserDetailPage } from '../../pages/UserDetailPage';
import { UsersPage } from '../../pages/UsersPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'contents', element: <ContentsPage /> },
      { path: 'contents/new', element: <CreateContentPage /> },
      { path: 'contents/:id', element: <ContentDetailPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'users/new', element: <CreateUserPage /> },
      { path: 'users/:id', element: <UserDetailPage /> },
      { path: 'system/outbox', element: <OutboxEventsPage /> },
      { path: 'system/outbox/:id', element: <OutboxEventDetailPage /> },
      { path: 'system/processed', element: <ProcessedMessagesPage /> },
      { path: 'system/processed/:id', element: <ProcessedMessageDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
