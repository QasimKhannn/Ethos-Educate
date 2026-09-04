import React, { memo } from 'react';
import { ControlCombobox } from '@librechat/client';
import { Controller, useFormContext } from 'react-hook-form';
import { TranslationKeys, useLocalize, useAgentCategories } from '~/hooks';
import { EMPTY_AGENT_CATEGORY } from '~/constants/agentCategories';
import type { AgentForm } from '~/common';
import { cn } from '~/utils';

const AgentCategorySelector: React.FC<{ className?: string }> = ({ className }) => {
  const localize = useLocalize();
  const formContext = useFormContext<AgentForm>();
  const { categories } = useAgentCategories();
  const getCategoryLabel = (category: { label: string; value: string }) => {
    if (category.label && category.label.startsWith('com_')) {
      return localize(category.label as TranslationKeys);
    }
    return category.label;
  };

  const comboboxItems = categories.map((category) => ({
    label: getCategoryLabel(category),
    value: category.value,
  }));

  const getCategoryDisplayValue = (value: string) => {
    const categoryItem = comboboxItems.find((c) => c.value === value);
    return (
      categoryItem?.label ||
      comboboxItems.find((c) => c.value === EMPTY_AGENT_CATEGORY.value)?.label ||
      comboboxItems[0]?.label
    );
  };

  const searchPlaceholder = localize('com_ui_search_agent_category');
  const ariaLabel = localize('com_ui_agent_category_selector_aria');

  return (
    <Controller
      name="category"
      control={formContext.control}
      defaultValue={EMPTY_AGENT_CATEGORY.value}
      render={({ field }) => {
        const selectedValue = field.value || EMPTY_AGENT_CATEGORY.value;
        const displayValue = getCategoryDisplayValue(selectedValue);

        return (
          <ControlCombobox
            selectedValue={selectedValue}
            displayValue={displayValue}
            searchPlaceholder={searchPlaceholder}
            setValue={(value) => {
              field.onChange(value);
            }}
            items={comboboxItems}
            className={cn(className)}
            ariaLabel={ariaLabel}
            isCollapsed={false}
            showCarat={true}
            popoverPortal
            popoverClassName="z-[160]"
          />
        );
      }}
    />
  );
};

const MemoizedAgentCategorySelector = memo(
  AgentCategorySelector,
  (prevProps, nextProps) => prevProps.className === nextProps.className,
);
MemoizedAgentCategorySelector.displayName = 'AgentCategorySelector';

export default MemoizedAgentCategorySelector;
