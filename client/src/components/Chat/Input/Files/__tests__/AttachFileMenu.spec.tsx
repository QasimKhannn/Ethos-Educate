import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecoilRoot } from 'recoil';
import AttachFileMenu from '../AttachFileMenu';

jest.mock('~/hooks', () => ({
  useAgentCapabilities: jest.fn(),
  useAgentToolPermissions: jest.fn(),
  useFileHandling: jest.fn(),
  useGetAgentsConfig: jest.fn(),
  useLocalize: jest.fn(),
}));

jest.mock('~/hooks/Files/useSharePointFileHandling', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('~/hooks/Files/uploadStrategy', () => ({
  resolveChatUploadToolResource: jest.fn(),
  resolveProviderUploadFileType: jest.fn(() => 'image_document'),
}));

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: jest.fn(),
}));

jest.mock('~/components/SharePoint', () => ({
  SharePointPickerDialog: () => null,
}));

jest.mock('@librechat/client', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactImport = require('react');

  return {
    AttachmentIcon: () => ReactImport.createElement('span', { 'data-testid': 'attachment-icon' }),
    DropdownPopup: (props) =>
      ReactImport.createElement(
        'div',
        null,
        ReactImport.createElement('div', { onClick: () => props.setIsOpen(!props.isOpen) }, props.trigger),
        props.isOpen === true
          ? ReactImport.createElement(
              'div',
              { 'data-testid': 'dropdown-menu' },
              props.items.map((item, index) =>
                ReactImport.createElement(
                  'button',
                  { key: index, onClick: item.onClick, 'data-testid': `menu-item-${index}` },
                  item.label,
                ),
              ),
            )
          : null,
      ),
    FileUpload: ReactImport.forwardRef((props: { children: React.ReactNode }, _ref) =>
      ReactImport.createElement('div', { 'data-testid': 'file-upload' }, props.children),
    ),
    SharePointIcon: () => ReactImport.createElement('span', { 'data-testid': 'sharepoint-icon' }),
    TooltipAnchor: (props) => props.render,
  };
});

const mockUseAgentCapabilities = jest.requireMock('~/hooks').useAgentCapabilities;
const mockUseAgentToolPermissions = jest.requireMock('~/hooks').useAgentToolPermissions;
const mockUseFileHandling = jest.requireMock('~/hooks').useFileHandling;
const mockUseGetAgentsConfig = jest.requireMock('~/hooks').useGetAgentsConfig;
const mockUseLocalize = jest.requireMock('~/hooks').useLocalize;
const mockUseSharePointFileHandling = jest.requireMock(
  '~/hooks/Files/useSharePointFileHandling',
).default;
const mockUseGetStartupConfig = jest.requireMock('~/data-provider').useGetStartupConfig;

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const setupMocks = () => {
  const translations: Record<string, string> = {
    com_files_upload_sharepoint: 'Upload from SharePoint',
    com_sidepanel_attach_files: 'Attach Files',
    com_ui_upload_files: 'Upload files',
  };

  mockUseLocalize.mockReturnValue((key: string) => translations[key] ?? key);
  mockUseAgentCapabilities.mockReturnValue({
    codeEnabled: true,
    contextEnabled: true,
    fileSearchEnabled: true,
  });
  mockUseAgentToolPermissions.mockReturnValue({
    codeAllowedByAgent: true,
    fileSearchAllowedByAgent: true,
    provider: undefined,
  });
  mockUseGetAgentsConfig.mockReturnValue({ agentsConfig: {} });
  mockUseFileHandling.mockReturnValue({ handleFileChange: jest.fn() });
  mockUseSharePointFileHandling.mockReturnValue({
    downloadProgress: 0,
    handleSharePointFiles: jest.fn(),
    isProcessing: false,
  });
  mockUseGetStartupConfig.mockReturnValue({ data: { sharePointFilePickerEnabled: false } });
};

const renderMenu = (props: Record<string, unknown> = {}) =>
  render(
    <QueryClientProvider client={queryClient}>
      <RecoilRoot>
        <AttachFileMenu conversationId="test-convo" {...props} />
      </RecoilRoot>
    </QueryClientProvider>,
  );

describe('AttachFileMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('renders a single attach button for direct uploads', () => {
    renderMenu();

    expect(screen.getByRole('button', { name: /attach files/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /attach files/i }));
    expect(screen.queryByTestId('dropdown-menu')).not.toBeInTheDocument();
  });

  it('keeps the button disabled when uploads are disabled', () => {
    renderMenu({ disabled: true });

    expect(screen.getByRole('button', { name: /attach files/i })).toBeDisabled();
  });

  it('shows a simplified two-item menu when SharePoint uploads are enabled', () => {
    mockUseGetStartupConfig.mockReturnValue({ data: { sharePointFilePickerEnabled: true } });

    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /attach files/i }));

    expect(screen.getByText('Upload files')).toBeInTheDocument();
    expect(screen.getByText('Upload from SharePoint')).toBeInTheDocument();
    expect(screen.queryByText('Upload as Text')).not.toBeInTheDocument();
    expect(screen.queryByText('Upload for File Search')).not.toBeInTheDocument();
    expect(screen.queryByText('Upload Code Files')).not.toBeInTheDocument();
  });
});
