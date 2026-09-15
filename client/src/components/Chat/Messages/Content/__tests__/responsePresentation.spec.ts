import { ContentTypes } from 'librechat-data-provider';
import type { TMessageContentParts } from 'librechat-data-provider';

import {
  hasInitialResponseContent,
  isActiveResponseMessage,
  isInitialResponsePartVisible,
} from '../responsePresentation';

describe('response presentation', () => {
  it('keeps the submitted assistant response active across route and message ID handoffs', () => {
    expect(
      isActiveResponseMessage({
        isSubmitting: true,
        isCreatedByUser: false,
        parentMessageId: 'user-1',
        activeUserMessageId: 'user-1',
        isLatestMessage: false,
        isLast: false,
      }),
    ).toBe(true);
    expect(
      isActiveResponseMessage({
        isSubmitting: true,
        isCreatedByUser: false,
        parentMessageId: 'user-2',
        activeUserMessageId: 'user-1',
        isLatestMessage: true,
        isLast: true,
      }),
    ).toBe(false);
    expect(
      isActiveResponseMessage({
        isSubmitting: true,
        isCreatedByUser: true,
        parentMessageId: 'user-1',
        activeUserMessageId: 'user-1',
        isLatestMessage: true,
        isLast: true,
      }),
    ).toBe(false);
  });

  it('falls back to tree position when a live submission identity is unavailable', () => {
    expect(
      isActiveResponseMessage({
        isSubmitting: true,
        isCreatedByUser: false,
        isLatestMessage: false,
        isLast: true,
      }),
    ).toBe(true);
  });

  it('keeps the thinking state for empty and partial initial text', () => {
    expect(hasInitialResponseContent([])).toBe(false);
    expect(
      isInitialResponsePartVisible({ type: ContentTypes.TEXT, text: '' } as TMessageContentParts),
    ).toBe(false);
    expect(
      isInitialResponsePartVisible({
        type: ContentTypes.TEXT,
        text: 'Hello',
      } as TMessageContentParts),
    ).toBe(false);
  });

  it('keeps the thinking state for internal parts that render no visible UI', () => {
    expect(
      isInitialResponsePartVisible({
        type: ContentTypes.AGENT_UPDATE,
        agent_update: { index: 0, runId: 'run-1', agentId: '' },
      }),
    ).toBe(false);
    expect(
      isInitialResponsePartVisible({
        type: ContentTypes.THINK,
        think: '<think> </think>',
      }),
    ).toBe(false);
    expect(
      isInitialResponsePartVisible({
        type: ContentTypes.ERROR,
        error: '',
      }),
    ).toBe(false);
  });

  it('shows the response after text or visible non-text content arrives', () => {
    expect(
      isInitialResponsePartVisible({
        type: ContentTypes.TEXT,
        text: 'Hello there',
      } as TMessageContentParts),
    ).toBe(true);
    expect(
      isInitialResponsePartVisible({
        type: ContentTypes.AGENT_UPDATE,
        agent_update: { index: 0, runId: 'run-1', agentId: 'agent-1' },
      }),
    ).toBe(true);
    expect(
      isInitialResponsePartVisible({
        type: ContentTypes.ERROR,
        error: 'Request failed',
      }),
    ).toBe(true);
    expect(
      isInitialResponsePartVisible({
        type: ContentTypes.TOOL_CALL,
        tool_call: { id: 'tool-1' },
      } as TMessageContentParts),
    ).toBe(true);
    expect(
      isInitialResponsePartVisible({
        type: ContentTypes.IMAGE_FILE,
        image_file: { file_id: 'image-1' },
      } as TMessageContentParts),
    ).toBe(true);
  });
});
