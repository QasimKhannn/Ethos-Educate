import { lazy, Suspense } from 'react';
import { Spinner } from '@librechat/client';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import type { ComponentType, LazyExoticComponent, PropsWithChildren } from 'react';
import Login from '~/components/Auth/Login';
import ApiErrorWatcher from '~/components/Auth/ApiErrorWatcher';
import { loadEssayGraderRoute } from '~/components/EssayGrader/loadEssayGraderRoute';
import { AuthContextProvider } from '~/hooks/AuthContext';
import { isEssayGraderEnabled } from '~/utils/featureFlags';
import { loadChatRoute } from './loadChatRoute';
import RouteErrorBoundary from './RouteErrorBoundary';
import StartupLayout from './Layouts/Startup';
import LoginLayout from './Layouts/Login';
import dashboardRoutes from './Dashboard';
const VerifyEmail = lazy(() => import('~/components/Auth/VerifyEmail'));
const Registration = lazy(() => import('~/components/Auth/Registration'));
const ResetPassword = lazy(() => import('~/components/Auth/ResetPassword'));
const TwoFactorScreen = lazy(() => import('~/components/Auth/TwoFactorScreen'));
const RequestPasswordReset = lazy(() => import('~/components/Auth/RequestPasswordReset'));
const OAuthSuccess = lazy(() => import('~/components/OAuth/OAuthSuccess'));
const OAuthError = lazy(() => import('~/components/OAuth/OAuthError'));
const ShareRoute = lazy(() => import('./ShareRoute'));
const Search = lazy(() => import('./Search'));
const ProjectRoute = lazy(() => import('~/components/Projects/ProjectRoute'));
const MarketplaceProvider = lazy(() =>
  import('~/components/Agents/MarketplaceContext').then(({ MarketplaceProvider }) => ({
    default: MarketplaceProvider,
  })),
);
const AgentMarketplace = lazy(() => import('~/components/Agents/Marketplace'));
const AdminConsole = lazy(() => import('~/components/Admin/AdminConsole'));
const CoworkLayout = lazy(() => import('~/components/Cowork/CoworkLayout'));
const CoworkHome = lazy(() => import('~/components/Cowork/CoworkHome'));
const CoworkProjectView = lazy(() => import('~/components/Cowork/CoworkProjectView'));
const Root = lazy(() => import('./Root'));
const ChatRoute = lazy(loadChatRoute);
const EssayGraderRoute = lazy(loadEssayGraderRoute);

type LazyRouteComponent = LazyExoticComponent<ComponentType>;

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center" aria-busy="true">
    <Spinner />
  </div>
);

const RouteSuspense = ({ children }: PropsWithChildren) => (
  <Suspense fallback={<RouteFallback />}>{children}</Suspense>
);

const lazyElement = (Component: LazyRouteComponent) => (
  <RouteSuspense>
    <Component />
  </RouteSuspense>
);

const AuthLayout = () => (
  <AuthContextProvider>
    <Outlet />
    <ApiErrorWatcher />
  </AuthContextProvider>
);

const baseEl = document.querySelector('base');
const baseHref = baseEl?.getAttribute('href') || '/';

export const router = createBrowserRouter(
  [
    {
      path: 'share/:shareId',
      element: lazyElement(ShareRoute),
      errorElement: <RouteErrorBoundary />,
    },
    {
      path: 'oauth',
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'success',
          element: lazyElement(OAuthSuccess),
        },
        {
          path: 'error',
          element: lazyElement(OAuthError),
        },
      ],
    },
    {
      path: '/',
      element: <StartupLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'register',
          element: lazyElement(Registration),
        },
        {
          path: 'forgot-password',
          element: lazyElement(RequestPasswordReset),
        },
        {
          path: 'reset-password',
          element: lazyElement(ResetPassword),
        },
      ],
    },
    {
      path: 'verify',
      element: lazyElement(VerifyEmail),
      errorElement: <RouteErrorBoundary />,
    },
    {
      element: <AuthLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: '/',
          element: <LoginLayout />,
          children: [
            {
              path: 'login',
              element: <Login />,
            },
            {
              path: 'login/2fa',
              element: lazyElement(TwoFactorScreen),
            },
          ],
        },
        dashboardRoutes,
        {
          path: '/',
          element: lazyElement(Root),
          children: [
            {
              index: true,
              element: <Navigate to="/c/new" replace={true} />,
            },
            {
              path: 'c/:conversationId?',
              element: lazyElement(ChatRoute),
            },
            {
              path: 'projects/:projectId',
              element: lazyElement(ProjectRoute),
            },
            {
              path: 'search',
              element: lazyElement(Search),
            },
            {
              path: 'agents',
              element: (
                <RouteSuspense>
                  <MarketplaceProvider>
                    <AgentMarketplace />
                  </MarketplaceProvider>
                </RouteSuspense>
              ),
            },
            {
              path: 'agents/:category',
              element: (
                <RouteSuspense>
                  <MarketplaceProvider>
                    <AgentMarketplace />
                  </MarketplaceProvider>
                </RouteSuspense>
              ),
            },
            ...(isEssayGraderEnabled
              ? [
                  {
                    path: 'tools/essay-grader',
                    element: lazyElement(EssayGraderRoute),
                  },
                ]
              : []),
            {
              path: 'admin',
              element: lazyElement(AdminConsole),
            },
            {
              path: 'cowork',
              element: lazyElement(CoworkLayout),
              children: [
                {
                  index: true,
                  element: lazyElement(CoworkHome),
                },
                {
                  path: ':projectId',
                  element: lazyElement(CoworkProjectView),
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  { basename: baseHref },
);
