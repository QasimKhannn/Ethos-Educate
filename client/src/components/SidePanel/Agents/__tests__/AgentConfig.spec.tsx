import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { EModelEndpoint } from 'librechat-data-provider';
import AgentConfig from '../AgentConfig';

jest.mock('~/utils', () => ({
  cn: (...classNames: Array<string | undefined>) => classNames.filter(Boolean).join(' '),
  defaultTextProps: '',
  processAgentOption: () => ({ code_files: [], context_files: [], knowledge_files: [] }),
  removeFocusOutlines: '',
  validateEmail: () => true,
}));

jest.mock('~/components/Tools', () => ({
  MCPToolSelectDialog: ({ endpoint, isOpen }: { endpoint: EModelEndpoint; isOpen: boolean }) =>
    isOpen ? <output data-testid="mcp-dialog-endpoint">{endpoint}</output> : null,
}));

jest.mock('~/hooks/Agents/useAgentCapabilities', () => ({
  __esModule: true,
  default: () => ({
    artifactsEnabled: false,
    codeEnabled: false,
    contextEnabled: false,
    fileSearchEnabled: false,
    webSearchEnabled: false,
  }),
}));

jest.mock('~/Providers', () => ({
  useAgentPanelContext: () => ({
    agentsConfig: { capabilities: {} },
    availableMCPServers: ['lesson-planning'],
    mcpServersMap: new Map(),
    regularTools: [],
  }),
  useFileMapContext: () => ({}),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
  useVisibleTools: () => ({ mcpServerNames: ['lesson-planning'] }),
}));

jest.mock('~/data-provider', () => ({
  useGetAgentFiles: () => ({ data: [] }),
}));

jest.mock('../MCPTools', () => ({
  __esModule: true,
  default: ({
    setShowMCPToolDialog,
  }: {
    setShowMCPToolDialog: (isOpen: boolean) => void;
  }) => (
    <button type="button" onClick={() => setShowMCPToolDialog(true)}>
      Open MCP tools
    </button>
  ),
}));

jest.mock('../AgentAvatar', () => ({ __esModule: true, default: () => null }));
jest.mock('../AgentCategorySelector', () => ({ __esModule: true, default: () => null }));
jest.mock('../AgentFieldLabel', () => ({ __esModule: true, default: () => null }));
jest.mock('../AgentIntakeFormConfig', () => ({ __esModule: true, default: () => null }));
jest.mock('../Artifacts', () => ({ __esModule: true, default: () => null }));
jest.mock('../Code/Form', () => ({ __esModule: true, default: () => null }));
jest.mock('../FileContext', () => ({ __esModule: true, default: () => null }));
jest.mock('../FileSearch', () => ({ __esModule: true, default: () => null }));
jest.mock('../Instructions', () => ({ __esModule: true, default: () => null }));
jest.mock('../RecommendedPrompts', () => ({ __esModule: true, default: () => null }));
jest.mock('../Search/Form', () => ({ __esModule: true, default: () => null }));

function TestWrapper() {
  const methods = useForm({
    defaultValues: {
      agent: { id: 'agent-123' },
      id: 'agent-123',
      tools: [],
    },
  });

  return (
    <FormProvider {...methods}>
      <AgentConfig />
    </FormProvider>
  );
}

describe('AgentConfig', () => {
  it('opens the MCP tool dialog with the agents endpoint', () => {
    render(<TestWrapper />);

    fireEvent.click(screen.getByRole('button', { name: 'Open MCP tools' }));

    expect(screen.getByTestId('mcp-dialog-endpoint').textContent).toBe(EModelEndpoint.agents);
  });
});
