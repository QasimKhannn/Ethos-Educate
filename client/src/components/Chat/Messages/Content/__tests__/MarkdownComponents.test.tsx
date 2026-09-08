import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { MessageContext } from '~/Providers';
import { a as MarkdownAnchor, img as MarkdownImage } from '../MarkdownComponents';

jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  TooltipAnchor: ({ render: content }: { render: React.ReactElement }) => content,
  useToastContext: () => ({ showToast: jest.fn() }),
}));

jest.mock('~/data-provider', () => ({
  useFileDownload: () => ({ refetch: jest.fn() }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) =>
    ({
      com_ui_ai_generated_image_notice:
        'This AI-generated image may contain mistakes or unexpected details. Please review it before using it.',
      com_ui_generated_file_expired_title: 'Looks like this file has expired',
      com_ui_generated_file_expired_description:
        "Oops, it is no longer available. Ask me to regenerate it and I'll create a fresh copy.",
      com_ui_generated_image_expired_title: 'Looks like this image has expired',
      com_ui_generated_image_expired_description:
        "Oops, it is no longer available. Ask me to generate it again and I'll make a fresh one.",
    })[key] ?? key,
}));

jest.mock('../DialogImage', () => ({
  __esModule: true,
  default: () => null,
}));

describe('MarkdownAnchor', () => {
  test('replaces an expired managed document link with an expiry notice', () => {
    const documentName = 'Worksheet.docx';

    render(
      <RecoilRoot>
        <MessageContext.Provider
          value={{
            messageId: 'message-123',
            isExpanded: true,
            generatedArtifactExpiries: new Map([
              ['file-456', new Date('2026-01-01T00:00:00.000Z')],
            ]),
          }}
        >
          <MarkdownAnchor href="/api/files/download/user-123/file-456">
            {documentName}
          </MarkdownAnchor>
        </MessageContext.Provider>
      </RecoilRoot>,
    );

    expect(screen.getByText('Looks like this file has expired')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: documentName })).not.toBeInTheDocument();
  });

  test('replaces an unavailable legacy Image MCP asset with an expiry notice', () => {
    render(
      <MarkdownImage
        src="https://image-gen-mcp.mangoocean-84242d32.eastus.azurecontainerapps.io/files/legacy.png"
        alt="Generated image"
      />,
    );

    fireEvent.error(screen.getByRole('img'));

    expect(screen.getByText('Looks like this image has expired')).toBeInTheDocument();
  });

  test('shows the review notice for a legacy Image MCP asset', () => {
    render(
      <MarkdownImage
        src="https://image-gen-mcp.mangoocean-84242d32.eastus.azurecontainerapps.io/files/legacy.png"
        alt="Generated image"
      />,
    );

    expect(
      screen.getByText(
        'This AI-generated image may contain mistakes or unexpected details. Please review it before using it.',
      ),
    ).toBeInTheDocument();
  });

  test('does not repeat a managed document card already rendered by its tool result', () => {
    const documentName = 'Worksheet.docx';

    render(
      <RecoilRoot>
        <MessageContext.Provider
          value={{
            messageId: 'message-123',
            isExpanded: true,
            isGeneratedDocumentToolCall: false,
            generatedDocumentToolCallFileIds: new Set(['file-456']),
          }}
        >
          <MarkdownAnchor href="/api/files/download/user-123/file-456">
            {documentName}
          </MarkdownAnchor>
        </MessageContext.Provider>
      </RecoilRoot>,
    );

    expect(screen.queryByRole('link', { name: documentName })).not.toBeInTheDocument();
    expect(screen.queryByText('Looks like this file has expired')).not.toBeInTheDocument();
  });
});
