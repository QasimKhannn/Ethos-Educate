import { EarthIcon } from 'lucide-react';
import {
  FileSources,
  EModelEndpoint,
  EToolResources,
  LocalStorageKeys,
  defaultAgentFormValues,
} from 'librechat-data-provider';
import type { Agent, TFile } from 'librechat-data-provider';
import type { DropdownValueSetter, TAgentOption, ExtendedFile } from '~/common';

/**
 * Creates a Dropdown value setter that always passes a string value,
 * for when options (object with label/value fields) are used for the
 * available values, and a string value is expected when selected.
 *
 * Only necessary when the available values are objects with label/value fields
 * and the selected value is expected to be a string.
 **/
export const createDropdownSetter = (setValue: (value: string) => void): DropdownValueSetter => {
  return (value) => {
    if (!value) {
      setValue('');
      return;
    }

    if (typeof value === 'string') {
      setValue(value);
      return;
    }

    if (value.value) {
      setValue(value.value + '');
    }
  };
};

const agentBuilderProviderAliases: Record<string, string> = {
  [EModelEndpoint.openAI]: 'Ethos Open',
  [EModelEndpoint.azureOpenAI]: 'Ethos Core',
  [EModelEndpoint.google]: 'Ethos Vision',
  [EModelEndpoint.anthropic]: 'Ethos Reason',
  [EModelEndpoint.assistants]: 'Ethos Assistants',
  [EModelEndpoint.azureAssistants]: 'Ethos Assistant Core',
  [EModelEndpoint.bedrock]: 'Ethos Cloud',
};

const agentBuilderModelAliases: Record<string, string> = {
  'gpt-5.2-chat': 'Ethos-1',
  'gpt-5-mini': 'Ethos-2',
  'gpt-5-nano': 'Ethos-3',
  'gemini-3-pro-preview': 'Ethos Vision Pro',
  'gemini-2.5-flash': 'Ethos Vision Fast',
  'claude-sonnet-4-6': 'Ethos Reason Pro',
  'claude-opus-4-6': 'Ethos Reason Elite',
  'claude-sonnet-4-5': 'Ethos Reason Plus',
  'claude-haiku-4-5': 'Ethos Reason Lite',
};

const providerPrefixesToHide = new Set([
  'gpt',
  'chatgpt',
  'gemini',
  'claude',
  'anthropic',
  'cohere',
  'meta',
  'mistral',
  'amazon',
  'ai21',
]);

const modelTokenAliases: Record<string, string> = {
  mini: 'Lite',
  nano: 'Nano',
  pro: 'Pro',
  preview: 'Preview',
  latest: 'Latest',
  thinking: 'Reasoning',
  codex: 'Build',
  flash: 'Fast',
  opus: 'Elite',
  sonnet: 'Pro',
  haiku: 'Lite',
  command: 'Command',
  plus: 'Plus',
  instruct: 'Instruct',
};

const toTitleCase = (value: string) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase()).replace(/\bV(\d+)/g, 'v$1');

const humanizeModelSuffix = (rawModel: string) => {
  const cleaned = rawModel
    .replace(/^[^.]+\./, '')
    .replace(/:[0-9]+$/g, '')
    .replace(/-v\d+(?::\d+)?$/gi, '')
    .replace(/_/g, '-');

  const parts = cleaned.split(/[-.:]+/).filter(Boolean);
  const formattedParts = parts
    .filter((part) => !providerPrefixesToHide.has(part.toLowerCase()))
    .map((part) => {
      const lower = part.toLowerCase();
      if (modelTokenAliases[lower] != null) {
        return modelTokenAliases[lower];
      }
      if (/^\d+[a-z]$/i.test(part)) {
        return part.toUpperCase();
      }
      if (/^\d+x\d+[a-z]?$/i.test(part)) {
        return part.toUpperCase();
      }
      if (/^\d{6,8}$/.test(part)) {
        return '';
      }
      return toTitleCase(part);
    })
    .filter(Boolean);

  return formattedParts.join(' ').trim();
};

const getModelFamilyPrefix = (rawModel: string) => {
  if (/^(gpt|chatgpt)/i.test(rawModel)) {
    return 'Ethos Open';
  }
  if (/^gemini/i.test(rawModel)) {
    return 'Ethos Vision';
  }
  if (/^claude/i.test(rawModel)) {
    return 'Ethos Reason';
  }
  if (/^[a-z0-9-]+\./i.test(rawModel)) {
    return 'Ethos Cloud';
  }
  return '';
};

export const getAgentBuilderProviderLabel = (provider: string | null | undefined) => {
  if (!provider) {
    return '';
  }
  return agentBuilderProviderAliases[provider] ?? toTitleCase(provider.replace(/([A-Z])/g, ' $1'));
};

export const getAgentBuilderModelLabel = (model: string | null | undefined) => {
  if (!model) {
    return '';
  }

  if (agentBuilderModelAliases[model] != null) {
    return agentBuilderModelAliases[model];
  }

  const prefix = getModelFamilyPrefix(model);
  const suffix = humanizeModelSuffix(model);

  if (!prefix) {
    return suffix || model;
  }

  return suffix ? `${prefix} ${suffix}` : prefix;
};

/**
 * Creates an Option object for a provider dropdown.
 **/
export const createProviderOption = (provider: string) => ({
  label: getAgentBuilderProviderLabel(provider),
  value: provider,
});

/**
 * Gets default agent form values with localStorage values for model and provider.
 * This is used to initialize agent forms with the last used model and provider.
 **/
export const getDefaultAgentFormValues = () => ({
  ...defaultAgentFormValues,
  model: localStorage.getItem(LocalStorageKeys.LAST_AGENT_MODEL) ?? '',
  provider: createProviderOption(localStorage.getItem(LocalStorageKeys.LAST_AGENT_PROVIDER) ?? ''),
  avatar_file: null,
  avatar_preview: '',
  avatar_action: null,
});

export const processAgentOption = ({
  agent: _agent,
  fileMap,
}: {
  agent?: Agent;
  fileMap?: Record<string, TFile | undefined>;
}): TAgentOption => {
  const isGlobal = _agent?.isPublic ?? false;

  const context_files = _agent?.tool_resources?.context?.file_ids ?? [];
  if (_agent?.tool_resources?.ocr?.file_ids) {
    /** Backwards-compatibility */
    context_files.push(..._agent.tool_resources.ocr.file_ids);
  }

  const agent: TAgentOption = {
    ...(_agent ?? ({} as Agent)),
    label: _agent?.name ?? '',
    value: _agent?.id ?? '',
    icon: isGlobal ? <EarthIcon className="icon-md text-green-400" /> : null,
    context_files: context_files.length > 0 ? ([] as Array<[string, ExtendedFile]>) : undefined,
    knowledge_files: _agent?.tool_resources?.file_search?.file_ids
      ? ([] as Array<[string, ExtendedFile]>)
      : undefined,
    code_files: _agent?.tool_resources?.execute_code?.file_ids
      ? ([] as Array<[string, ExtendedFile]>)
      : undefined,
  };

  if (!fileMap) {
    return agent;
  }

  const handleFile = ({
    file_id,
    tool_resource,
    list,
  }: {
    file_id: string;
    tool_resource: EToolResources;
    list?: Array<[string, ExtendedFile]>;
  }) => {
    const file = fileMap[file_id];
    const source =
      tool_resource === EToolResources.file_search
        ? FileSources.vectordb
        : (file?.source ?? FileSources.local);

    if (file) {
      list?.push([
        file_id,
        {
          file_id: file.file_id,
          type: file.type,
          filepath: file.filepath,
          filename: file.filename,
          width: file.width,
          height: file.height,
          size: file.bytes,
          preview: file.filepath,
          metadata: file.metadata,
          progress: 1,
          source,
        },
      ]);
    } else {
      list?.push([
        file_id,
        {
          file_id,
          type: '',
          filename: '',
          size: 1,
          progress: 1,
          filepath: EModelEndpoint.agents,
          source,
        },
      ]);
    }
  };

  if (agent.context_files && context_files.length > 0) {
    context_files.forEach((file_id) =>
      handleFile({
        file_id,
        list: agent.context_files,
        tool_resource: EToolResources.context,
      }),
    );
  }

  if (agent.knowledge_files && _agent?.tool_resources?.file_search?.file_ids) {
    _agent.tool_resources.file_search.file_ids.forEach((file_id) =>
      handleFile({
        file_id,
        list: agent.knowledge_files,
        tool_resource: EToolResources.file_search,
      }),
    );
  }

  if (agent.code_files && _agent?.tool_resources?.execute_code?.file_ids) {
    _agent.tool_resources.execute_code.file_ids.forEach((file_id) =>
      handleFile({ file_id, list: agent.code_files, tool_resource: EToolResources.execute_code }),
    );
  }

  return agent;
};
