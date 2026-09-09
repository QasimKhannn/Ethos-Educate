import type { TConversation } from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks';
import {
  getMockNavigationConversation,
  getMockNavigationConversations,
  getMockNavigationMessages,
  getMockNavigationProjects,
  isMockNavigationConversation,
  isMockNavigationUser,
  mergeMockNavigationConversations,
} from '../mockNavigation';

const localize = (key: TranslationKeys) => key;

const createConversation = (conversationId: string): TConversation => ({
  conversationId,
  endpoint: null,
  title: conversationId,
  createdAt: '2026-08-06T08:00:00.000Z',
  updatedAt: '2026-08-06T08:00:00.000Z',
});

describe('mockNavigation', () => {
  it('limits demo navigation to the dedicated mock account', () => {
    expect(isMockNavigationUser({ name: 'Mock User', username: 'mock' })).toBe(true);
    expect(isMockNavigationUser({ name: 'Mock Student', username: 'mock-student-sep9' })).toBe(
      true,
    );
    expect(isMockNavigationUser({ name: 'Teacher', username: 'teacher' })).toBe(false);
    expect(isMockNavigationUser()).toBe(false);
  });

  it('builds localized projects with nested conversation ids', () => {
    const projects = getMockNavigationProjects(localize);

    expect(projects).toHaveLength(4);
    expect(projects[0].project.name).toBe('com_nav_mock_project_classroom_planning');
    expect(projects[0].isFavorite).toBe(true);
    expect(projects[0].project.updatedAt).toBe(projects[0].lastWorkedAt);
    expect(projects[0].project.conversationIds).toHaveLength(3);
    expect(projects[0].conversations[0].projectId).toBe(projects[0].project._id);
    expect(isMockNavigationConversation(projects[0].conversations[0].conversationId)).toBe(true);
  });

  it('fills a short real conversation list without replacing real entries', () => {
    const realConversation = createConversation('real-conversation');
    const mockConversations = getMockNavigationConversations(localize);
    const merged = mergeMockNavigationConversations([realConversation], mockConversations, 5);

    expect(merged).toHaveLength(5);
    expect(merged[0]).toBe(realConversation);
    expect(new Set(merged.map((conversation) => conversation.conversationId)).size).toBe(5);
  });

  it('builds a linked preview transcript for a mock conversation', () => {
    const conversation = getMockNavigationConversations(localize)[0];
    const messages = getMockNavigationMessages(conversation, localize);

    expect(messages).toHaveLength(2);
    expect(messages[0].isCreatedByUser).toBe(true);
    expect(messages[0].responseMessageId).toBe(messages[1].messageId);
    expect(messages[1].parentMessageId).toBe(messages[0].messageId);
    expect(messages[1].conversationId).toBe(conversation.conversationId);
    expect(messages[1].text).toBe('com_nav_mock_chat_preview_response');
  });

  it('resolves project conversations for routed previews', () => {
    const projectConversation = getMockNavigationProjects(localize)[1].conversations[0];

    expect(
      getMockNavigationConversation(projectConversation.conversationId ?? '', localize),
    ).toEqual(projectConversation);
  });

  it('does not add demo entries once the target density is reached', () => {
    const realConversations = Array.from({ length: 3 }, (_, index) =>
      createConversation(`real-${index}`),
    );

    expect(
      mergeMockNavigationConversations(
        realConversations,
        getMockNavigationConversations(localize),
        3,
      ),
    ).toBe(realConversations);
  });
});
