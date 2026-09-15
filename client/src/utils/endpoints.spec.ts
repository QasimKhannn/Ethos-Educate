import { EModelEndpoint, getEndpointField } from 'librechat-data-provider';
import type {
  TConfig,
  TConversation,
  TEndpointsConfig,
  TStartupConfig,
} from 'librechat-data-provider';
import {
  mapEndpoints,
  getEndpointsFilter,
  getAvailableEndpoints,
  reconcileConversationModelSpec,
} from './endpoints';

const mockEndpointsConfig: TEndpointsConfig = {
  [EModelEndpoint.openAI]: { type: undefined, iconURL: 'openAI_icon.png', order: 0 },
  [EModelEndpoint.google]: { type: undefined, iconURL: 'google_icon.png', order: 1 },
  Mistral: { type: EModelEndpoint.custom, iconURL: 'custom_icon.png', order: 2 },
};

describe('getEndpointField', () => {
  it('returns undefined if endpointsConfig is undefined', () => {
    expect(getEndpointField(undefined, EModelEndpoint.openAI, 'type')).toBeUndefined();
  });

  it('returns undefined if endpoint is null', () => {
    expect(getEndpointField(mockEndpointsConfig, null, 'type')).toBeUndefined();
  });

  it('returns undefined if endpoint is undefined', () => {
    expect(getEndpointField(mockEndpointsConfig, undefined, 'type')).toBeUndefined();
  });

  it('returns the correct value for a valid endpoint and property', () => {
    expect(getEndpointField(mockEndpointsConfig, EModelEndpoint.openAI, 'order')).toEqual(0);
    expect(getEndpointField(mockEndpointsConfig, EModelEndpoint.google, 'iconURL')).toEqual(
      'google_icon.png',
    );
  });

  it('returns undefined for a valid endpoint but an invalid property', () => {
    /* Type assertion as 'nonexistentProperty' is intentionally not a valid property of TConfig */
    expect(
      getEndpointField(
        mockEndpointsConfig,
        EModelEndpoint.openAI,
        'nonexistentProperty' as keyof TConfig,
      ),
    ).toBeUndefined();
  });

  it('returns the correct value for a non-enum endpoint and valid property', () => {
    expect(getEndpointField(mockEndpointsConfig, 'Mistral', 'type')).toEqual(EModelEndpoint.custom);
  });

  it('returns undefined for a non-enum endpoint with an invalid property', () => {
    expect(
      getEndpointField(mockEndpointsConfig, 'Mistral', 'nonexistentProperty' as keyof TConfig),
    ).toBeUndefined();
  });
});

describe('getEndpointsFilter', () => {
  it('returns an empty object if endpointsConfig is undefined', () => {
    expect(getEndpointsFilter(undefined)).toEqual({});
  });

  it('returns a filter object based on endpointsConfig', () => {
    const expectedFilter = {
      [EModelEndpoint.openAI]: true,
      [EModelEndpoint.google]: true,
      Mistral: true,
    };
    expect(getEndpointsFilter(mockEndpointsConfig)).toEqual(expectedFilter);
  });
});

describe('getAvailableEndpoints', () => {
  it('returns available endpoints based on filter and config', () => {
    const filter = {
      [EModelEndpoint.openAI]: true,
      [EModelEndpoint.google]: false,
      Mistral: true,
    };
    const expectedEndpoints = [EModelEndpoint.openAI, 'Mistral'];
    expect(getAvailableEndpoints(filter, mockEndpointsConfig)).toEqual(expectedEndpoints);
  });
});

describe('mapEndpoints', () => {
  it('returns sorted available endpoints', () => {
    const expectedOrder = [EModelEndpoint.openAI, EModelEndpoint.google, 'Mistral'];
    expect(mapEndpoints(mockEndpointsConfig)).toEqual(expectedOrder);
  });
});

describe('reconcileConversationModelSpec', () => {
  const startupConfig = {
    modelSpecs: {
      list: [
        {
          name: 'Ethos-Pro',
          label: 'Ethos-Pro',
          preset: {
            endpoint: EModelEndpoint.azureOpenAI,
            model: 'gpt-5.2-chat',
            modelLabel: 'Ethos-Pro',
          },
        },
      ],
    },
  } as TStartupConfig;

  it('uses the configured model and label for a saved model spec', () => {
    const conversation = {
      conversationId: 'conversation-1',
      endpoint: EModelEndpoint.azureOpenAI,
      model: 'gpt-5.4',
      spec: 'Ethos-Pro',
      title: 'Existing chat',
    } as TConversation;

    expect(reconcileConversationModelSpec(conversation, startupConfig)).toEqual(
      expect.objectContaining({
        conversationId: 'conversation-1',
        model: 'gpt-5.2-chat',
        modelLabel: 'Ethos-Pro',
        spec: 'Ethos-Pro',
        title: 'Existing chat',
      }),
    );
  });

  it('leaves conversations without a matching model spec unchanged', () => {
    const conversation = {
      conversationId: 'conversation-2',
      endpoint: EModelEndpoint.google,
      model: 'gemini-2.5-flash',
      title: 'Google chat',
    } as TConversation;

    expect(reconcileConversationModelSpec(conversation, startupConfig)).toBe(conversation);
  });
});
