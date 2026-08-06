import { Constants, EModelEndpoint } from 'librechat-data-provider';
import type { TConversation, TMessage, TProject, TUser } from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks';

type Localize = (
  key: TranslationKeys,
  options?: Record<string, boolean | number | string>,
) => string;

type MockProjectDefinition = {
  accent: MockProjectAccent;
  chatKeys: readonly TranslationKeys[];
  id: string;
  isFavorite: boolean;
  lastWorkedDayOffset: number;
  nameKey: TranslationKeys;
};

type MockConversationDefinition = {
  dayOffset: number;
  hourOffset: number;
  id: string;
  titleKey: TranslationKeys;
};

export type MockProjectAccent = 'gold' | 'sky' | 'teal' | 'violet';

export type MockNavigationProject = {
  accent: MockProjectAccent;
  conversations: TConversation[];
  isFavorite: boolean;
  lastWorkedAt: string;
  project: TProject;
};

const mockProjectIdPrefix = 'ethos-mock-navigation-project-';
const mockConversationIdPrefix = 'ethos-mock-navigation-chat-';

const mockProjectDefinitions: readonly MockProjectDefinition[] = [
  {
    id: 'classroom-planning',
    isFavorite: true,
    lastWorkedDayOffset: 1,
    nameKey: 'com_nav_mock_project_classroom_planning',
    accent: 'gold',
    chatKeys: [
      'com_nav_mock_project_chat_ecosystems_unit',
      'com_nav_mock_project_chat_formative_assessment',
      'com_nav_mock_project_chat_differentiation',
    ],
  },
  {
    id: 'student-support',
    isFavorite: false,
    lastWorkedDayOffset: 0,
    nameKey: 'com_nav_mock_project_student_support',
    accent: 'teal',
    chatKeys: [
      'com_nav_mock_project_chat_accommodation_checklist',
      'com_nav_mock_project_chat_family_conference',
    ],
  },
  {
    id: 'faculty-development',
    isFavorite: false,
    lastWorkedDayOffset: 2,
    nameKey: 'com_nav_mock_project_faculty_development',
    accent: 'violet',
    chatKeys: [
      'com_nav_mock_project_chat_ai_literacy',
      'com_nav_mock_project_chat_coaching_agenda',
    ],
  },
  {
    id: 'school-communications',
    isFavorite: false,
    lastWorkedDayOffset: 4,
    nameKey: 'com_nav_mock_project_school_communications',
    accent: 'sky',
    chatKeys: [
      'com_nav_mock_project_chat_family_newsletter',
      'com_nav_mock_project_chat_attendance_reminder',
    ],
  },
];

const mockConversationDefinitions: readonly MockConversationDefinition[] = [
  {
    id: 'parent-update',
    titleKey: 'com_nav_mock_chat_parent_update',
    dayOffset: 0,
    hourOffset: 1,
  },
  {
    id: 'policy-changes',
    titleKey: 'com_nav_mock_chat_policy_changes',
    dayOffset: 0,
    hourOffset: 3,
  },
  {
    id: 'friday-quiz',
    titleKey: 'com_nav_mock_chat_friday_quiz',
    dayOffset: 0,
    hourOffset: 6,
  },
  {
    id: 'lesson-objectives',
    titleKey: 'com_nav_mock_chat_lesson_objectives',
    dayOffset: 1,
    hourOffset: 2,
  },
  {
    id: 'staff-agenda',
    titleKey: 'com_nav_mock_chat_staff_agenda',
    dayOffset: 1,
    hourOffset: 5,
  },
  {
    id: 'reflection-prompts',
    titleKey: 'com_nav_mock_chat_reflection_prompts',
    dayOffset: 3,
    hourOffset: 2,
  },
  {
    id: 'grant-shortlist',
    titleKey: 'com_nav_mock_chat_grant_shortlist',
    dayOffset: 4,
    hourOffset: 4,
  },
  {
    id: 'classroom-newsletter',
    titleKey: 'com_nav_mock_chat_classroom_newsletter',
    dayOffset: 6,
    hourOffset: 1,
  },
];

const createTimestamp = (dayOffset: number, hourOffset: number) => {
  const timestamp = new Date();
  timestamp.setDate(timestamp.getDate() - dayOffset);
  timestamp.setHours(Math.max(0, timestamp.getHours() - hourOffset), 0, 0, 0);
  return timestamp.toISOString();
};

const createMockConversation = ({
  id,
  title,
  projectId,
  dayOffset,
  hourOffset,
}: {
  dayOffset: number;
  hourOffset: number;
  id: string;
  projectId?: string;
  title: string;
}): TConversation => {
  const timestamp = createTimestamp(dayOffset, hourOffset);
  return {
    conversationId: `${mockConversationIdPrefix}${id}`,
    endpoint: EModelEndpoint.azureOpenAI,
    model: 'gpt-5-mini',
    modelLabel: 'Ethos-Pro',
    spec: 'Ethos-Pro',
    projectId,
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const isMockNavigationUser = (user?: Pick<TUser, 'name' | 'username'>): boolean => {
  const identities = [user?.name, user?.username];
  return identities.some((identity) => {
    const normalized = identity?.trim().toLowerCase();
    return normalized === 'mock user' || normalized === 'mockuser';
  });
};

export const isMockNavigationConversation = (conversationId?: string | null) =>
  conversationId?.startsWith(mockConversationIdPrefix) === true;

export const getMockNavigationProjects = (localize: Localize): MockNavigationProject[] =>
  mockProjectDefinitions.map((definition) => {
    const projectId = `${mockProjectIdPrefix}${definition.id}`;
    const lastWorkedAt = createTimestamp(definition.lastWorkedDayOffset, 1);
    const conversations = definition.chatKeys.map((chatKey, index) =>
      createMockConversation({
        id: `${definition.id}-${index + 1}`,
        title: localize(chatKey),
        projectId,
        dayOffset: index,
        hourOffset: index + 1,
      }),
    );

    return {
      accent: definition.accent,
      conversations,
      isFavorite: definition.isFavorite,
      lastWorkedAt,
      project: {
        _id: projectId,
        name: localize(definition.nameKey),
        createdAt: createTimestamp(definition.lastWorkedDayOffset + 7, 1),
        updatedAt: lastWorkedAt,
        conversationIds: conversations
          .map((conversation) => conversation.conversationId)
          .filter((conversationId): conversationId is string => conversationId != null),
      },
    };
  });

export const getMockNavigationConversations = (localize: Localize): TConversation[] =>
  mockConversationDefinitions.map((definition) =>
    createMockConversation({
      id: definition.id,
      title: localize(definition.titleKey),
      dayOffset: definition.dayOffset,
      hourOffset: definition.hourOffset,
    }),
  );

export const getMockNavigationConversation = (
  conversationId: string,
  localize: Localize,
): TConversation | undefined => {
  const standaloneConversation = getMockNavigationConversations(localize).find(
    (conversation) => conversation.conversationId === conversationId,
  );
  if (standaloneConversation) {
    return standaloneConversation;
  }

  for (const project of getMockNavigationProjects(localize)) {
    const projectConversation = project.conversations.find(
      (conversation) => conversation.conversationId === conversationId,
    );
    if (projectConversation) {
      return projectConversation;
    }
  }

  return undefined;
};

export const getMockNavigationMessages = (
  conversation: TConversation,
  localize: Localize,
): TMessage[] => {
  const conversationId = conversation.conversationId;
  if (!conversationId || !isMockNavigationConversation(conversationId)) {
    return [];
  }

  const title = conversation.title || localize('com_ui_untitled');
  const createdAt = conversation.createdAt || new Date().toISOString();
  const userMessageId = `${conversationId}-user`;
  const responseMessageId = `${conversationId}-response`;

  return [
    {
      messageId: userMessageId,
      conversationId,
      parentMessageId: Constants.NO_PARENT,
      responseMessageId,
      isCreatedByUser: true,
      sender: 'User',
      text: localize('com_nav_mock_chat_preview_prompt', { title }),
      createdAt,
      updatedAt: createdAt,
    },
    {
      messageId: responseMessageId,
      conversationId,
      parentMessageId: userMessageId,
      isCreatedByUser: false,
      sender: conversation.modelLabel || 'Ethos-Pro',
      endpoint: conversation.endpoint || EModelEndpoint.azureOpenAI,
      model: conversation.model || 'gpt-5-mini',
      text: localize('com_nav_mock_chat_preview_response', { title }),
      createdAt,
      updatedAt: createdAt,
    },
  ];
};

export const mergeMockNavigationConversations = (
  conversations: TConversation[],
  mockConversations: TConversation[],
  targetCount = 8,
): TConversation[] => {
  if (conversations.length >= targetCount) {
    return conversations;
  }

  const existingIds = new Set(conversations.map((conversation) => conversation.conversationId));
  const additions: TConversation[] = [];
  const remainingCount = targetCount - conversations.length;

  for (const conversation of mockConversations) {
    if (existingIds.has(conversation.conversationId)) {
      continue;
    }
    additions.push(conversation);
    if (additions.length === remainingCount) {
      break;
    }
  }

  return additions.length === 0 ? conversations : [...conversations, ...additions];
};
