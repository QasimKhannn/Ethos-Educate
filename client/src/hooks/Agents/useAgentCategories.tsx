import { useMemo } from 'react';

import useLocalize from '~/hooks/useLocalize';
import { useGetAgentCategoriesQuery } from '~/data-provider/Agents';
import { EMPTY_AGENT_CATEGORY } from '~/constants/agentCategories';
import type { TranslationKeys } from '~/hooks';

// This interface matches the structure used by the ControlCombobox component
export interface ProcessedAgentCategory {
  label: string; // Translated label
  value: string; // Category value
  className?: string;
  icon?: string;
}

const categoryDisplayOverrides: Record<string, string> = {
  general: 'General',
  hr: 'Human Resources',
  rd: 'Research & Development',
  finance: 'Finance',
  it: 'IT',
  sales: 'Sales',
  aftersales: 'After Sales',
};

export const getFriendlyAgentCategoryLabel = ({
  value,
  label,
  localize,
}: {
  value: string;
  label?: string | null;
  localize: (key: TranslationKeys, vars?: Record<string, unknown>) => string;
}) => {
  if (value === 'promoted') {
    return localize('com_agents_top_picks');
  }

  if (value === 'all') {
    return localize('com_agents_all_category');
  }

  if (categoryDisplayOverrides[value]) {
    return categoryDisplayOverrides[value];
  }

  if (label && label.startsWith('com_')) {
    return localize(label as TranslationKeys);
  }

  return label || value.charAt(0).toUpperCase() + value.slice(1);
};

/**
 * Custom hook that provides processed and translated agent categories from API
 *
 * @returns Object containing categories, emptyCategory, and loading state
 */
const useAgentCategories = () => {
  const localize = useLocalize();

  // Fetch categories from API
  const categoriesQuery = useGetAgentCategoriesQuery({
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  const categories = useMemo((): ProcessedAgentCategory[] => {
    if (!categoriesQuery.data) return [];

    // Filter out special categories (promoted, all) and convert to form format
    return categoriesQuery.data
      .filter((category) => category.value !== 'promoted' && category.value !== 'all')
      .map((category) => ({
        label: getFriendlyAgentCategoryLabel({
          value: category.value,
          label: category.label,
          localize,
        }),
        value: category.value,
        className: 'w-full',
      }));
  }, [categoriesQuery.data, localize]);

  const emptyCategory = useMemo(
    (): ProcessedAgentCategory => ({
      label: localize(EMPTY_AGENT_CATEGORY.label),
      value: EMPTY_AGENT_CATEGORY.value,
      className: 'w-full',
    }),
    [localize],
  );

  return {
    categories,
    emptyCategory,
    isLoading: categoriesQuery.isLoading,
    error: categoriesQuery.error,
  };
};

export default useAgentCategories;
