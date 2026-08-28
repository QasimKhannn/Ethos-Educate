import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import type { PropsWithChildren } from 'react';

const DashboardRoute = lazy(() => import('./Layouts/Dashboard'));
const PromptsView = lazy(() => import('~/components/Prompts/PromptsView'));
const PromptForm = lazy(() => import('~/components/Prompts/PromptForm'));
const CreatePromptForm = lazy(() => import('~/components/Prompts/Groups/CreatePromptForm'));
const EmptyPromptPreview = lazy(() => import('~/components/Prompts/EmptyPromptPreview'));

const DashboardSuspense = ({ children }: PropsWithChildren) => (
  <Suspense fallback={null}>{children}</Suspense>
);

const dashboardRoutes = {
  path: 'd/*',
  element: (
    <DashboardSuspense>
      <DashboardRoute />
    </DashboardSuspense>
  ),
  children: [
    /*
    {
      element: <FileDashboardView />,
      children: [
        {
          index: true,
          element: <EmptyVectorStorePreview />,
        },
        {
          path: ':vectorStoreId',
          element: <DataTableFilePreview />,
        },
      ],
    },
    {
      path: 'files/*',
      element: <FilesListView />,
      children: [
        {
          index: true,
          element: <EmptyFilePreview />,
        },
        {
          path: ':fileId',
          element: <FilePreview />,
        },
      ],
    },
    {
      path: 'vector-stores/*',
      element: <VectorStoreView />,
      children: [
        {
          index: true,
          element: <EmptyVectorStorePreview />,
        },
        {
          path: ':vectorStoreId',
          element: <VectorStorePreview />,
        },
      ],
    },
    */
    {
      path: 'prompts/*',
      element: (
        <DashboardSuspense>
          <PromptsView />
        </DashboardSuspense>
      ),
      children: [
        {
          index: true,
          element: (
            <DashboardSuspense>
              <EmptyPromptPreview />
            </DashboardSuspense>
          ),
        },
        {
          path: 'new',
          element: (
            <DashboardSuspense>
              <CreatePromptForm />
            </DashboardSuspense>
          ),
        },
        {
          path: ':promptId',
          element: (
            <DashboardSuspense>
              <PromptForm />
            </DashboardSuspense>
          ),
        },
      ],
    },
    {
      path: '*',
      element: <Navigate to="/d/prompts" replace={true} />,
    },
  ],
};

export default dashboardRoutes;
