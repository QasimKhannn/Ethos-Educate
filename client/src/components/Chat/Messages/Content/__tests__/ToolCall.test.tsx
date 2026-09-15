import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { Constants, Tools } from 'librechat-data-provider';
import { MessageContext } from '~/Providers';
import ToolCall from '../ToolCall';

// Mock dependencies
jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, values?: any) => {
    const translations: Record<string, string> = {
      com_assistants_function_use: `Used ${values?.[0]}`,
      com_assistants_completed_function: `Completed ${values?.[0]}`,
      com_assistants_completed_action: `Completed action on ${values?.[0]}`,
      com_assistants_running_var: `Running ${values?.[0]}`,
      com_assistants_running_action: 'Running action',
      com_ui_sign_in_to_domain: `Sign in to ${values?.[0]}`,
      com_ui_cancelled: 'Cancelled',
      com_ui_requires_auth: 'Requires authentication',
      com_ui_tool_activity_failed: 'We could not complete this request',
      com_ui_tool_activity_document_completed: 'Your downloadable resource is ready',
      com_ui_tool_activity_generic_completed: 'Your request is complete',
      com_ui_tool_activity_generic_title: 'Working on your request',
      com_ui_tool_activity_generic_working: 'Putting the next steps together…',
      com_ui_tool_activity_in_progress: 'In progress',
      com_ui_tool_activity_interrupted: 'This request was interrupted',
      com_ui_tool_activity_image_completed: 'Your image is ready',
      com_ui_tool_activity_needs_auth: 'Sign in to continue',
      com_ui_tool_activity_problem_guidance:
        'Please try again. If this continues, check the selected tool or contact your administrator.',
      com_ui_tool_activity_technical_details: 'Technical details',
      com_assistants_allow_sites_you_trust: 'Only allow sites you trust',
      com_ui_generated_file_expired_description:
        'That file is no longer available, but I can create a fresh copy from the original request.',
      com_ui_generated_files_expired_description:
        'Those files are no longer available, but I can create fresh copies from the original request.',
      com_ui_generated_document_retention_notice: 'This document will be available for 24 hours.',
      com_ui_generated_documents_retention_notice:
        'These documents will be available for 24 hours.',
      com_ui_generated_file_expired_action: 'Create again',
      com_ui_regenerating: 'Regenerating...',
    };
    return translations[key] || key;
  },
  useProgress: (initialProgress: number) => (initialProgress >= 1 ? 1 : initialProgress),
}));

jest.mock('~/components/Chat/Messages/Content/MessageContent', () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => <div data-testid="message-content">{content}</div>,
}));

jest.mock('../ToolCallInfo', () => ({
  __esModule: true,
  default: ({ attachments, ...props }: any) => (
    <div data-testid="tool-call-info" data-attachments={JSON.stringify(attachments)}>
      {JSON.stringify(props)}
    </div>
  ),
}));

jest.mock('../Markdown', () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => (
    <div data-testid="generated-document-markdown">{content}</div>
  ),
}));

jest.mock('../ProgressText', () => ({
  __esModule: true,
  default: ({ onClick, inProgressText, finishedText, _error, _hasInput, _isExpanded }: any) => (
    <div onClick={onClick}>{finishedText || inProgressText}</div>
  ),
}));

jest.mock('../Parts', () => ({
  AttachmentGroup: ({ attachments }: any) => (
    <div data-testid="attachment-group">{JSON.stringify(attachments)}</div>
  ),
}));

jest.mock('~/components/ui', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('lucide-react', () => ({
  BarChart3: () => <span>{'BarChart3'}</span>,
  Check: () => <span>{'Check'}</span>,
  ChevronDown: () => <span>{'ChevronDown'}</span>,
  ChevronUp: () => <span>{'ChevronUp'}</span>,
  TriangleAlert: () => <span>{'TriangleAlert'}</span>,
  CircleAlert: () => <span>{'CircleAlert'}</span>,
  FileSearch: () => <span>{'FileSearch'}</span>,
  FileText: () => <span>{'FileText'}</span>,
  FolderSearch: () => <span>{'FolderSearch'}</span>,
  ImageIcon: () => <span>{'ImageIcon'}</span>,
  KeyRound: () => <span>{'KeyRound'}</span>,
  Search: () => <span>{'Search'}</span>,
  WifiOff: () => <span>{'WifiOff'}</span>,
  Wrench: () => <span>{'Wrench'}</span>,
  FileClock: () => <span>{'FileClock'}</span>,
  ImageOff: () => <span>{'ImageOff'}</span>,
  RefreshCw: () => <span>{'RefreshCw'}</span>,
}));

jest.mock('~/utils', () => ({
  logger: {
    error: jest.fn(),
  },
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

describe('ToolCall', () => {
  const mockProps = {
    args: '{"test": "input"}',
    name: 'testFunction',
    output: 'Test output',
    initialProgress: 1,
    isSubmitting: false,
  };

  const renderWithRecoil = (component: React.ReactElement) => {
    return render(<RecoilRoot>{component}</RecoilRoot>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('attachments prop passing', () => {
    it('should pass attachments to ToolCallInfo when provided', () => {
      const attachments = [
        {
          type: Tools.ui_resources,
          messageId: 'msg123',
          toolCallId: 'tool456',
          conversationId: 'conv789',
          [Tools.ui_resources]: {
            '0': { type: 'button', label: 'Click me' },
          },
        },
      ];

      renderWithRecoil(<ToolCall {...mockProps} attachments={attachments} />);

      fireEvent.click(screen.getByText('Your request is complete'));

      const toolCallInfo = screen.getByTestId('tool-call-info');
      expect(toolCallInfo).toBeInTheDocument();

      const attachmentsData = toolCallInfo.getAttribute('data-attachments');
      expect(attachmentsData).toBe(JSON.stringify(attachments));
    });

    it('should pass empty array when no attachments', () => {
      renderWithRecoil(<ToolCall {...mockProps} />);

      fireEvent.click(screen.getByText('Your request is complete'));

      const toolCallInfo = screen.getByTestId('tool-call-info');
      const attachmentsData = toolCallInfo.getAttribute('data-attachments');
      expect(attachmentsData).toBeNull(); // JSON.stringify(undefined) returns undefined, so attribute is not set
    });

    it('should pass multiple attachments of different types', () => {
      const attachments = [
        {
          type: Tools.ui_resources,
          messageId: 'msg1',
          toolCallId: 'tool1',
          conversationId: 'conv1',
          [Tools.ui_resources]: {
            '0': { type: 'form', fields: [] },
          },
        },
        {
          type: Tools.web_search,
          messageId: 'msg2',
          toolCallId: 'tool2',
          conversationId: 'conv2',
          [Tools.web_search]: {
            results: ['result1', 'result2'],
          },
        },
      ];

      renderWithRecoil(<ToolCall {...mockProps} attachments={attachments} />);

      fireEvent.click(screen.getByText('Your request is complete'));

      const toolCallInfo = screen.getByTestId('tool-call-info');
      const attachmentsData = toolCallInfo.getAttribute('data-attachments');
      expect(JSON.parse(attachmentsData!)).toEqual(attachments);
    });
  });

  describe('attachment group rendering', () => {
    it('should render AttachmentGroup when attachments are provided', () => {
      const attachments = [
        {
          type: Tools.ui_resources,
          messageId: 'msg123',
          toolCallId: 'tool456',
          conversationId: 'conv789',
          [Tools.ui_resources]: {
            '0': { type: 'chart', data: [] },
          },
        },
      ];

      renderWithRecoil(<ToolCall {...mockProps} attachments={attachments} />);

      const attachmentGroup = screen.getByTestId('attachment-group');
      expect(attachmentGroup).toBeInTheDocument();
      expect(attachmentGroup.textContent).toBe(JSON.stringify(attachments));
    });

    it('should not render AttachmentGroup when no attachments', () => {
      renderWithRecoil(<ToolCall {...mockProps} />);

      expect(screen.queryByTestId('attachment-group')).not.toBeInTheDocument();
    });

    it('should not render AttachmentGroup when attachments is empty array', () => {
      renderWithRecoil(<ToolCall {...mockProps} attachments={[]} />);

      expect(screen.queryByTestId('attachment-group')).not.toBeInTheDocument();
    });
  });

  describe('tool call info visibility', () => {
    it('keeps a completed image activity visible above the image result', () => {
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          name={`generate_images${Constants.mcp_delimiter}Image_Generation`}
        />,
      );

      expect(document.querySelector('[data-tool-activity-category="image"]')).toBeInTheDocument();
      expect(screen.getByText('Your image is ready')).not.toHaveClass('shimmer');
    });

    it('keeps a completed document activity visible above the downloadable file', () => {
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          name={`downloadable_document_builder${Constants.mcp_delimiter}Downloadable-Files-Creation`}
        />,
      );

      expect(
        document.querySelector('[data-tool-activity-category="document"]'),
      ).toBeInTheDocument();
      expect(screen.getByText('Your downloadable resource is ready')).not.toHaveClass('shimmer');
    });

    it('shows a document activity card while the downloadable file is being created', () => {
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          initialProgress={0.5}
          isSubmitting={true}
          name={`downloadable_document_builder${Constants.mcp_delimiter}Downloadable-Files-Creation`}
        />,
      );

      expect(
        document.querySelector('[data-tool-activity-category="document"]'),
      ).toBeInTheDocument();
    });

    it('hides an interrupted activity card so the chat error is the only user-facing error', () => {
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          initialProgress={0.5}
          isSubmitting={false}
          name={`generate_images${Constants.mcp_delimiter}Image_Generation`}
        />,
      );

      expect(
        document.querySelector('[data-tool-activity-category="image"]'),
      ).not.toBeInTheDocument();
    });

    it('should toggle tool call info when clicking header', () => {
      renderWithRecoil(<ToolCall {...mockProps} />);

      // Initially closed
      expect(screen.queryByTestId('tool-call-info')).not.toBeInTheDocument();

      // Click to open
      fireEvent.click(screen.getByText('Your request is complete'));
      expect(screen.getByTestId('tool-call-info')).toBeInTheDocument();

      // Click to close
      fireEvent.click(screen.getByText('Your request is complete'));
      expect(screen.queryByTestId('tool-call-info')).not.toBeInTheDocument();
    });

    it('should pass all required props to ToolCallInfo', () => {
      const attachments = [
        {
          type: Tools.ui_resources,
          messageId: 'msg123',
          toolCallId: 'tool456',
          conversationId: 'conv789',
          [Tools.ui_resources]: {
            '0': { type: 'button', label: 'Test' },
          },
        },
      ];

      // Use a name with domain separator (_action_) and domain separator (---)
      const propsWithDomain = {
        ...mockProps,
        name: 'testFunction_action_test---domain---com', // domain will be extracted and --- replaced with dots
        attachments,
      };

      renderWithRecoil(<ToolCall {...propsWithDomain} />);

      fireEvent.click(screen.getByText('Your request is complete'));

      const toolCallInfo = screen.getByTestId('tool-call-info');
      const props = JSON.parse(toolCallInfo.textContent!);

      expect(props.input).toBe('{"test": "input"}');
      expect(props.output).toBe('Test output');
      expect(props.function_name).toBe('testFunction');
      // Domain is extracted from name and --- are replaced with dots
      expect(props.domain).toBe('test.domain.com');
      expect(props.pendingAuth).toBe(false);
    });
  });

  describe('authentication flow', () => {
    it('should show sign-in button when auth URL is provided', () => {
      const originalOpen = window.open;
      window.open = jest.fn();

      renderWithRecoil(
        <ToolCall
          {...mockProps}
          initialProgress={0.5} // Less than 1 so it's not complete
          auth="https://auth.example.com"
          isSubmitting={true} // Should be submitting for auth to show
        />,
      );

      const signInButton = screen.getByText('Sign in to auth.example.com');
      expect(signInButton).toBeInTheDocument();

      fireEvent.click(signInButton);
      expect(window.open).toHaveBeenCalledWith(
        'https://auth.example.com',
        '_blank',
        'noopener,noreferrer',
      );

      window.open = originalOpen;
    });

    it('should pass pendingAuth as true when auth is pending', () => {
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          auth="https://auth.example.com" // Need auth URL to extract domain
          initialProgress={0.5} // Less than 1
          isSubmitting={true} // Still submitting
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Technical details' }));

      const toolCallInfo = screen.getByTestId('tool-call-info');
      const props = JSON.parse(toolCallInfo.textContent!);
      expect(props.pendingAuth).toBe(true);
    });

    it('should not show auth section when cancelled', () => {
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          auth="https://auth.example.com"
          authDomain="example.com"
          progress={0.5}
          cancelled={true}
        />,
      );

      expect(screen.queryByText('Sign in to example.com')).not.toBeInTheDocument();
    });

    it('should not show auth section when progress is complete', () => {
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          auth="https://auth.example.com"
          authDomain="example.com"
          progress={1}
          cancelled={false}
        />,
      );

      expect(screen.queryByText('Sign in to example.com')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined args', () => {
      renderWithRecoil(<ToolCall {...mockProps} args={undefined} />);

      fireEvent.click(screen.getByText('Your request is complete'));

      const toolCallInfo = screen.getByTestId('tool-call-info');
      const props = JSON.parse(toolCallInfo.textContent!);
      expect(props.input).toBe('');
    });

    it('should handle null output', () => {
      renderWithRecoil(<ToolCall {...mockProps} output={null} />);

      fireEvent.click(screen.getByText('Your request is complete'));

      const toolCallInfo = screen.getByTestId('tool-call-info');
      const props = JSON.parse(toolCallInfo.textContent!);
      expect(props.output).toBeNull();
    });

    it('should handle missing domain', () => {
      renderWithRecoil(<ToolCall {...mockProps} domain={undefined} authDomain={undefined} />);

      fireEvent.click(screen.getByText('Your request is complete'));

      const toolCallInfo = screen.getByTestId('tool-call-info');
      const props = JSON.parse(toolCallInfo.textContent!);
      expect(props.domain).toBe('');
    });

    it('should handle complex nested attachments', () => {
      const complexAttachments = [
        {
          type: Tools.ui_resources,
          messageId: 'msg123',
          toolCallId: 'tool456',
          conversationId: 'conv789',
          [Tools.ui_resources]: {
            '0': {
              type: 'nested',
              data: {
                deep: {
                  value: 'test',
                  array: [1, 2, 3],
                  object: { key: 'value' },
                },
              },
            },
          },
        },
      ];

      renderWithRecoil(<ToolCall {...mockProps} attachments={complexAttachments} />);

      fireEvent.click(screen.getByText('Your request is complete'));

      const toolCallInfo = screen.getByTestId('tool-call-info');
      const attachmentsData = toolCallInfo.getAttribute('data-attachments');
      expect(JSON.parse(attachmentsData!)).toEqual(complexAttachments);

      const attachmentGroup = screen.getByTestId('attachment-group');
      expect(JSON.parse(attachmentGroup.textContent!)).toEqual(complexAttachments);
    });
  });

  describe('generated document retention', () => {
    it('shows a 24-hour availability notice with a generated document download', () => {
      const output = '[Student Worksheet.docx](/api/files/download/user-123/file-456)';

      renderWithRecoil(<ToolCall {...mockProps} output={output} />);

      expect(screen.getByText('This document will be available for 24 hours.')).toBeInTheDocument();
    });

    it('renders one expiry notice and direct retry action for all expired files from a tool result', () => {
      const output = [
        'Available until 2026-09-03 21:54 UTC.',
        '[Student Worksheet.docx](/api/files/download/user-123/file-456)',
        '[Teacher Answer Key.docx](/api/files/download/user-123/file-789)',
      ].join('\n\n');
      const onRegenerate = jest.fn();

      renderWithRecoil(
        <MessageContext.Provider
          value={{
            messageId: 'message-123',
            isExpanded: true,
            isGeneratedDocumentToolCall: true,
            generatedArtifactExpiries: new Map([
              ['file-456', new Date('2026-01-01T00:00:00.000Z')],
              ['file-789', new Date('2026-01-01T00:00:00.000Z')],
            ]),
            onRegenerate,
          }}
        >
          <ToolCall {...mockProps} output={output} />
        </MessageContext.Provider>,
      );

      expect(
        screen.getAllByText(
          'Those files are no longer available, but I can create fresh copies from the original request.',
        ),
      ).toHaveLength(1);
      expect(
        screen.queryByText(
          'That file is no longer available, but I can create a fresh copy from the original request.',
        ),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Create again/ }));
      expect(onRegenerate).toHaveBeenCalledTimes(1);
    });
  });
});
