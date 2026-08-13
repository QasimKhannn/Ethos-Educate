import { TranslationKeys } from '~/hooks/useLocalize';

export interface AgentCategory {
  label: TranslationKeys;
  value: string;
}

// The empty category placeholder - used for form defaults
export const EMPTY_AGENT_CATEGORY: AgentCategory = {
  value: 'teaching_learning',
  label: 'com_ui_agent_category_teaching_learning',
};
