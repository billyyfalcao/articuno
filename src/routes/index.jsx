import { createBrowserRouter, redirect } from 'react-router';
import { ROUTES } from './paths';
import ProtectedRoute from './ProtectedRoute';
import AdminLayout from '@/layouts/AdminLayout';
import DriverLayout from '@/layouts/DriverLayout';
import NotFoundPage from '@/pages/NotFoundPage';

const lazyPage = (importer) => async () => {
  const module = await importer();
  return { Component: module.default };
};

export const routes = [
  {
    path: ROUTES.ROOT,
    loader: () => redirect(ROUTES.ADMIN.DASHBOARD),
  },
  {
    path: ROUTES.ADMIN.DASHBOARD,
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    errorElement: <NotFoundPage />,
    children: [
      { index: true, lazy: lazyPage(() => import('@/pages/admin/DashboardPage')) },
      { path: 'veiculos', lazy: lazyPage(() => import('@/pages/admin/VehiclesPage')) },
      { path: 'setores', lazy: lazyPage(() => import('@/pages/admin/SectorsPage')) },
      { path: 'historico', lazy: lazyPage(() => import('@/pages/admin/HistoryPage')) },
    ],
  },
  {
    path: ROUTES.DRIVER.TICKET,
    element: <DriverLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, lazy: lazyPage(() => import('@/pages/driver/TicketPage')) },
      { path: 'localizacao', lazy: lazyPage(() => import('@/pages/driver/LocationPage')) },
      { path: 'pagamento', lazy: lazyPage(() => import('@/pages/driver/PaymentPage')) },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

export const createAppRouter = () => createBrowserRouter(routes);
