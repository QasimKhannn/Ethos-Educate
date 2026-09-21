import { EModelEndpoint } from 'librechat-data-provider';
import type { LocalizeFunction, SelectedValues } from '~/common';
import { getDisplayValue } from '../utils';

const localize: LocalizeFunction = (key) => key;

const emptySelection: SelectedValues = {
  endpoint: '',
  model: '',
  modelSpec: '',
};

describe('getDisplayValue', () => {
  it('shows the active agent configured model when the agent is absent from the cached list', () => {
    const displayValue = getDisplayValue({
      localize,
      selectedValues: emptySelection,
      mappedEndpoints: [],
      modelSpecs: [],
      conversationEndpoint: EModelEndpoint.agents,
      agentModel: 'gpt-5-chat',
    });

    expect(displayValue).toBe('Ethos-Pro');
  });

  it('uses the selected agent model when the active agent model has not loaded yet', () => {
    const displayValue = getDisplayValue({
      localize,
      selectedValues: {
        endpoint: EModelEndpoint.agents,
        model: 'agent_certificate_creator',
        modelSpec: '',
      },
      mappedEndpoints: [
        {
          value: EModelEndpoint.agents,
          label: 'Agents',
          hasModels: true,
          icon: null,
        },
      ],
      modelSpecs: [],
      agentsMap: {
        agent_certificate_creator: {
          model: 'gpt-5-chat',
        },
      },
    });

    expect(displayValue).toBe('Ethos-Pro');
  });
});
