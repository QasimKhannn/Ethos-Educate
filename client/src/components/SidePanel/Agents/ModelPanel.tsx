import React, { useEffect, useMemo, useState } from 'react';
import keyBy from 'lodash/keyBy';
import { ControlCombobox } from '@librechat/client';
import { ChevronDown, ChevronLeft, RotateCcw } from 'lucide-react';
import { useFormContext, useWatch, Controller } from 'react-hook-form';
import { componentMapping } from '~/components/SidePanel/Parameters/components';
import {
  getSettingsKeys,
  getEndpointField,
  LocalStorageKeys,
  SettingDefinition,
  agentParamSettings,
} from 'librechat-data-provider';
import type * as t from 'librechat-data-provider';
import type { AgentForm, AgentModelPanelProps, StringOption } from '~/common';
import { useGetEndpointsQuery } from '~/data-provider';
import { useLiveAnnouncer } from '~/Providers';
import { useLocalize } from '~/hooks';
import { Panel } from '~/common';
import { cn, getAgentBuilderModelLabel, getAgentBuilderProviderLabel } from '~/utils';

export default function ModelPanel({
  providers,
  setActivePanel,
  models: modelsData,
}: Pick<AgentModelPanelProps, 'models' | 'providers' | 'setActivePanel'>) {
  const localize = useLocalize();
  const { announcePolite } = useLiveAnnouncer();

  const { control, setValue } = useFormContext<AgentForm>();

  const model = useWatch({ control, name: 'model' });
  const providerOption = useWatch({ control, name: 'provider' });
  const modelParameters = useWatch({ control, name: 'model_parameters' });
  const hasModelParameters = Object.keys(modelParameters ?? {}).length > 0;
  const [isParametersOpen, setIsParametersOpen] = useState(hasModelParameters);

  const provider = useMemo(() => {
    const value =
      typeof providerOption === 'string'
        ? providerOption
        : (providerOption as StringOption | undefined)?.value;
    return value ?? '';
  }, [providerOption]);
  const models = useMemo(
    () => (provider ? (modelsData[provider] ?? []) : []),
    [modelsData, provider],
  );
  const selectedModelDisplay = useMemo(() => getAgentBuilderModelLabel(model), [model]);

  useEffect(() => {
    const _model = model ?? '';
    if (provider && _model) {
      const modelExists = models.includes(_model);
      if (!modelExists) {
        const newModels = modelsData[provider] ?? [];
        setValue('model', newModels[0] ?? '');
      }
      localStorage.setItem(LocalStorageKeys.LAST_AGENT_MODEL, _model);
      localStorage.setItem(LocalStorageKeys.LAST_AGENT_PROVIDER, provider);
    }

    if (provider && !_model) {
      setValue('model', models[0] ?? '');
    }
  }, [provider, models, modelsData, setValue, model]);

  useEffect(() => {
    if (hasModelParameters) {
      setIsParametersOpen(true);
    }
  }, [hasModelParameters]);

  const { data: endpointsConfig = {} } = useGetEndpointsQuery();

  const bedrockRegions = useMemo(() => {
    return endpointsConfig?.[provider]?.availableRegions ?? [];
  }, [endpointsConfig, provider]);

  const endpointType = useMemo(
    () => getEndpointField(endpointsConfig, provider, 'type'),
    [provider, endpointsConfig],
  );

  const parameters = useMemo((): SettingDefinition[] => {
    const customParams = endpointsConfig[provider]?.customParams ?? {};
    const [combinedKey, endpointKey] = getSettingsKeys(endpointType ?? provider, model ?? '');
    const overriddenEndpointKey = customParams.defaultParamsEndpoint ?? endpointKey;
    const defaultParams =
      agentParamSettings[combinedKey] ?? agentParamSettings[overriddenEndpointKey] ?? [];
    const overriddenParams = endpointsConfig[provider]?.customParams?.paramDefinitions ?? [];
    const overriddenParamsMap = keyBy(overriddenParams, 'key');
    return defaultParams
      .filter((param) => param != null)
      .map((param) => (overriddenParamsMap[param.key] as SettingDefinition) ?? param);
  }, [endpointType, endpointsConfig, model, provider]);

  const setOption = (optionKey: keyof t.AgentModelParameters) => (value: t.AgentParameterValue) => {
    setValue(`model_parameters.${optionKey}`, value);
  };

  const handleResetParameters = () => {
    setValue('model_parameters', {} as t.AgentModelParameters);
    announcePolite({ message: localize('com_ui_model_parameters_reset'), isStatus: true });
  };

  return (
    <div className="agent-builder-subpanel text-sm">
      <div className="agent-builder-subpanel-header">
        <button
          type="button"
          className="agent-builder-subpanel-back btn btn-neutral"
          onClick={() => {
            setActivePanel(Panel.builder);
          }}
          aria-label={localize('com_ui_back_to_builder')}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <h3>{localize('com_ui_model_parameters')}</h3>
      </div>
      <div className="agent-builder-subpanel-content">
        {/* Endpoint aka Provider for Agents */}
        <div className="agent-builder-subpanel-field">
          <label
            id="provider-label"
            className="agent-builder-subpanel-label text-token-text-primary"
            htmlFor="provider"
          >
            {localize('com_ui_provider')} <span className="text-red-500">*</span>
          </label>
          <Controller
            name="provider"
            control={control}
            rules={{ required: true, minLength: 1 }}
            render={({ field, fieldState: { error } }) => {
              const value =
                typeof field.value === 'string'
                  ? field.value
                  : ((field.value as StringOption)?.value ?? '');
              const display = getAgentBuilderProviderLabel(value);

              return (
                <>
                  <ControlCombobox
                    selectedValue={value}
                    displayValue={display}
                    selectPlaceholder={localize('com_ui_select_provider')}
                    searchPlaceholder={localize('com_ui_select_search_provider')}
                    setValue={field.onChange}
                    items={providers.map((provider) => ({
                      label:
                        typeof provider === 'string'
                          ? getAgentBuilderProviderLabel(provider)
                          : getAgentBuilderProviderLabel((provider.value as string) ?? ''),
                      value: typeof provider === 'string' ? provider : provider.value,
                    }))}
                    className={cn(
                      'agent-builder-subpanel-select',
                      error ? 'border-2 border-red-500' : '',
                    )}
                    ariaLabel={localize('com_ui_provider')}
                    isCollapsed={false}
                    showCarat={true}
                    popoverPortal
                  />
                  {error && (
                    <span className="model-panel-error text-sm text-red-500 transition duration-300 ease-in-out">
                      {localize('com_ui_field_required')}
                    </span>
                  )}
                </>
              );
            }}
          />
        </div>
        {/* Model */}
        <div className="agent-builder-subpanel-field">
          <label
            id="model-label"
            className={cn(
              'agent-builder-subpanel-label text-token-text-primary',
              !provider && 'text-gray-500 dark:text-gray-400',
            )}
            htmlFor="model"
          >
            {localize('com_ui_model')} <span className="text-red-500">*</span>
          </label>
          <Controller
            name="model"
            control={control}
            rules={{ required: true, minLength: 1 }}
            render={({ field, fieldState: { error } }) => {
              return (
                <>
                  <ControlCombobox
                    selectedValue={field.value || ''}
                    displayValue={selectedModelDisplay}
                    selectPlaceholder={
                      provider
                        ? localize('com_ui_select_model')
                        : localize('com_ui_select_provider_first')
                    }
                    searchPlaceholder={localize('com_ui_select_model')}
                    setValue={field.onChange}
                    items={models.map((model) => ({
                      label: getAgentBuilderModelLabel(model),
                      value: model,
                    }))}
                    disabled={!provider}
                    className={cn(
                      'agent-builder-subpanel-select disabled:opacity-50',
                      error ? 'border-2 border-red-500' : '',
                    )}
                    ariaLabel={localize('com_ui_model')}
                    isCollapsed={false}
                    showCarat={true}
                    popoverPortal
                  />
                  {provider && error && (
                    <span className="text-sm text-red-500 transition duration-300 ease-in-out">
                      {localize('com_ui_field_required')}
                    </span>
                  )}
                </>
              );
            }}
          />
        </div>
        {parameters.length > 0 && (
          <details
            className="agent-builder-model-parameters"
            open={isParametersOpen}
            onToggle={(event) => setIsParametersOpen(event.currentTarget.open)}
          >
            <summary>
              <span className="agent-builder-model-parameters-summary-copy">
                <span className="agent-builder-model-parameters-title">
                  {localize('com_ui_model_parameters')}
                </span>
                <span className="agent-builder-model-parameters-description">
                  {localize('com_ui_tooltip_model_parameters')}
                </span>
              </span>
              <ChevronDown className="agent-builder-model-parameters-chevron" aria-hidden="true" />
            </summary>
            <div className="agent-builder-model-parameters-content">
              <div className="agent-builder-model-parameters-grid">
                {parameters.map((setting) => {
                  const Component = componentMapping[setting.component];
                  if (!Component) {
                    return null;
                  }
                  const { key, default: defaultValue, ...rest } = setting;

                  if (key === 'region' && bedrockRegions.length) {
                    rest.options = bedrockRegions;
                  }

                  return (
                    <div key={key} className="agent-builder-model-parameter">
                      <Component
                        settingKey={key}
                        defaultValue={defaultValue}
                        {...rest}
                        setOption={setOption as t.TSetOption}
                        conversation={modelParameters as Partial<t.TConversation>}
                      />
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={handleResetParameters}
                className="btn btn-neutral agent-builder-model-parameters-reset flex w-full items-center justify-center gap-2 px-4 py-2 text-sm"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {localize('com_ui_reset_var', { 0: localize('com_ui_model_parameters') })}
              </button>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
