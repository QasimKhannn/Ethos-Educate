import React from 'react';
import { render, waitFor } from '@testing-library/react';

const mockQueryClients = [];
const mockStartupQuery = jest.fn();

jest.mock('recoil', () => ({
  RecoilRoot: ({ children }) => children,
}));

jest.mock('react-dnd', () => ({
  DndProvider: ({ children }) => children,
}));

jest.mock('react-dnd-html5-backend', () => ({
  HTML5Backend: {},
}));

jest.mock('react-router-dom', () => {
  const { useQuery, useQueryClient } = jest.requireActual('@tanstack/react-query');

  return {
    RouterProvider: () => {
      mockQueryClients.push(useQueryClient());
      useQuery({
        queryKey: ['app-query-client-stability'],
        queryFn: mockStartupQuery,
        staleTime: Infinity,
      });
      return null;
    },
  };
});

jest.mock('@radix-ui/react-toast', () => ({
  Provider: ({ children }) => children,
  Viewport: () => null,
}));

jest.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => null,
}));

jest.mock('@librechat/client', () => ({
  ThemeProvider: ({ children }) => children,
  ToastProvider: ({ children }) => children,
  Toast: () => null,
}));

jest.mock('./hooks', () => ({
  ScreenshotProvider: ({ children }) => children,
  useApiErrorBoundary: () => ({ setError: jest.fn() }),
}));

jest.mock('~/components/System/WakeLockManager', () => () => null);
jest.mock('~/utils/getThemeFromEnv', () => ({ getThemeFromEnv: () => undefined }));
jest.mock('~/store/fontSize', () => ({ initializeFontSize: jest.fn() }));
jest.mock('~/a11y', () => ({ LiveAnnouncer: ({ children }) => children }));
jest.mock('./routes', () => ({ router: {} }));

import App from './App';

describe('App', () => {
  beforeEach(() => {
    mockQueryClients.length = 0;
    mockStartupQuery.mockResolvedValue({});
  });

  it('keeps the React Query client and cached startup query across application rerenders', async () => {
    const { rerender } = render(<App />);

    await waitFor(() => expect(mockStartupQuery).toHaveBeenCalledTimes(1));
    const initialQueryClient = mockQueryClients.at(-1);
    const initialRenderCount = mockQueryClients.length;

    rerender(<App />);

    await waitFor(() => expect(mockQueryClients.length).toBeGreaterThan(initialRenderCount));

    expect(new Set(mockQueryClients)).toEqual(new Set([initialQueryClient]));
    expect(mockStartupQuery).toHaveBeenCalledTimes(1);
  });
});
