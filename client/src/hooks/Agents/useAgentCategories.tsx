import { useMemo } from 'react';

import useLocalize from '~/hooks/useLocalize';
import { useGetAgentCategoriesQuery } from '~/data-provider/Agents';
import { EMPTY_AGENT_CATEGORY } from '~/constants/agentCategories';
import type { TranslationKeys } from '~/hooks';

type AgentCategoryOption = {
  value: string;
  label?: string | null;
  description?: string | null;
  count?: number;
};

type ResolvedAgentCategoryOption = {
  value: string;
  label: string;
  description: string;
  count: number;
};

// This interface matches the structure used by the ControlCombobox component
export interface ProcessedAgentCategory {
  label: string; // Translated label
  value: string; // Category value
  className?: string;
  icon?: string;
}

const formatCategoryValue = (value: string) =>
  value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const commonAgentCategories: ResolvedAgentCategoryOption[] = [
  {
    value: 'planning_instruction',
    label: 'Planning Instruction',
    description: 'Lesson planning, activities, assessments, and instructional resources.',
    count: 0,
  },
  {
    value: 'content_creation',
    label: 'Content Creation',
    description: 'Visual, audio, presentation, document, and media creation.',
    count: 0,
  },
  {
    value: 'communication',
    label: 'Communication',
    description: 'Parent, staff, student, and community communications.',
    count: 0,
  },
  {
    value: 'student_support',
    label: 'Student Support',
    description: 'Student accommodations, differentiation, and support workflows.',
    count: 0,
  },
  {
    value: 'operations_support',
    label: 'Operations Support',
    description: 'Meetings, school operations, reporting, systems, and support guides.',
    count: 0,
  },
];

const categoryDisplayOverrides: Record<string, string> = {
  general: 'General',
  hr: 'Human Resources',
  rd: 'Research & Development',
  finance: 'Finance',
  it: 'IT',
  sales: 'Sales',
  aftersales: 'After Sales',
  planning_instruction: 'Planning Instruction',
  content_creation: 'Content Creation',
  communication: 'Communication',
  student_support: 'Student Support',
  operations_support: 'Operations Support',
};

const legacyAgentCategoryValues = new Set([
  'general',
  'hr',
  'rd',
  'finance',
  'it',
  'sales',
  'aftersales',
]);
const commonAgentCategoryValues = new Set(commonAgentCategories.map((category) => category.value));

export const mergeCommonAgentCategories = (
  apiCategories: AgentCategoryOption[] | undefined,
): ResolvedAgentCategoryOption[] => {
  const categoriesByValue = new Map(apiCategories?.map((category) => [category.value, category]));
  const commonCategories = commonAgentCategories.map((category) => ({
    ...category,
    count: categoriesByValue.get(category.value)?.count ?? category.count,
  }));
  const extraCategories =
    apiCategories
      ?.filter((category) => {
        if (category.value === 'all' || category.value === 'promoted') {
          return false;
        }

        if (legacyAgentCategoryValues.has(category.value)) {
          return false;
        }

        return !commonAgentCategoryValues.has(category.value) && (category.count ?? 0) > 0;
      })
      .map((category) => ({
        value: category.value,
        label: category.label ?? formatCategoryValue(category.value),
        description: category.description ?? '',
        count: category.count ?? 0,
      })) ?? [];

  return [...commonCategories, ...extraCategories];
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

  return label || formatCategoryValue(value);
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
    const sourceCategories = mergeCommonAgentCategories(categoriesQuery.data);

    return sourceCategories
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
