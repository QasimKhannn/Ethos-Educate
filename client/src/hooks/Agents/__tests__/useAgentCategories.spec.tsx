import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useAgentCategories, { commonAgentCategories } from '../useAgentCategories';
import { EMPTY_AGENT_CATEGORY } from '~/constants/agentCategories';

// Mock the useLocalize hook
jest.mock('~/hooks/useLocalize', () => ({
  __esModule: true,
  default: () => (key: string) => {
    // Simple mock implementation that returns the key as the translation
    return key === 'com_ui_agent_category_general' ? 'General (Translated)' : key;
  },
}));

// Mock the data provider
jest.mock('~/data-provider/Agents', () => ({
  useGetAgentCategoriesQuery: jest.fn(() => ({
    data: [
      { value: 'general', label: 'com_ui_agent_category_general' },
      { value: 'hr', label: 'com_ui_agent_category_hr' },
      { value: 'rd', label: 'com_ui_agent_category_rd' },
      { value: 'finance', label: 'com_ui_agent_category_finance' },
      { value: 'it', label: 'com_ui_agent_category_it' },
      { value: 'sales', label: 'com_ui_agent_category_sales' },
      { value: 'aftersales', label: 'com_ui_agent_category_aftersales' },
      { value: 'promoted', label: 'Promoted' }, // Should be filtered out
      { value: 'all', label: 'All' }, // Should be filtered out
    ],
    isLoading: false,
    error: null,
  })),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useAgentCategories', () => {
  it('should return processed categories with correct structure', async () => {
    const { result } = renderHook(() => useAgentCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.categories).toHaveLength(commonAgentCategories.length);
    });

    // Check that the supported marketplace categories have the expected structure.
    const firstCategory = result.current.categories[0];
    expect(firstCategory.value).toBe('teaching_learning');
    expect(firstCategory.label).toBe('Teaching & Learning');
    expect(firstCategory.className).toBe('w-full');

    const categoryValues = result.current.categories.map((cat) => cat.value);
    expect(categoryValues).toEqual(commonAgentCategories.map((category) => category.value));
    expect(categoryValues).not.toContain('promoted');
    expect(categoryValues).not.toContain('all');
    expect(categoryValues).not.toContain('general');

    // Check the empty category
    expect(result.current.emptyCategory.value).toBe(EMPTY_AGENT_CATEGORY.value);
    expect(result.current.emptyCategory.label).toBe(EMPTY_AGENT_CATEGORY.label);
    expect(result.current.emptyCategory.className).toBe('w-full');

    // Check loading state
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
