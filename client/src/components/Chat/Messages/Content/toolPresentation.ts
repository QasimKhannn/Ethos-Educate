export type ToolActivityCategory =
  | 'analysis'
  | 'document'
  | 'generic'
  | 'image'
  | 'knowledge'
  | 'lesson'
  | 'school_files'
  | 'web_search'
  | 'workspace';

export type ToolActivityPresentation = {
  category: ToolActivityCategory;
  titleKey: string;
  workingPhraseKeys: readonly string[];
  completedKey: string;
};

const presentations: Record<ToolActivityCategory, ToolActivityPresentation> = {
  analysis: {
    category: 'analysis',
    titleKey: 'com_ui_tool_activity_analysis_title',
    workingPhraseKeys: ['com_ui_tool_activity_analysis_working'],
    completedKey: 'com_ui_tool_activity_analysis_completed',
  },
  document: {
    category: 'document',
    titleKey: 'com_ui_tool_activity_document_title',
    workingPhraseKeys: [
      'com_ui_tool_activity_document_phrase_one',
      'com_ui_tool_activity_document_phrase_two',
      'com_ui_tool_activity_document_phrase_three',
    ],
    completedKey: 'com_ui_tool_activity_document_completed',
  },
  generic: {
    category: 'generic',
    titleKey: 'com_ui_tool_activity_generic_title',
    workingPhraseKeys: ['com_ui_tool_activity_generic_working'],
    completedKey: 'com_ui_tool_activity_generic_completed',
  },
  image: {
    category: 'image',
    titleKey: 'com_ui_tool_activity_image_title',
    workingPhraseKeys: [
      'com_ui_tool_activity_image_phrase_one',
      'com_ui_tool_activity_image_phrase_two',
      'com_ui_tool_activity_image_phrase_three',
      'com_ui_tool_activity_image_phrase_four',
    ],
    completedKey: 'com_ui_tool_activity_image_completed',
  },
  knowledge: {
    category: 'knowledge',
    titleKey: 'com_ui_tool_activity_knowledge_title',
    workingPhraseKeys: ['com_ui_tool_activity_knowledge_working'],
    completedKey: 'com_ui_tool_activity_knowledge_completed',
  },
  lesson: {
    category: 'lesson',
    titleKey: 'com_ui_tool_activity_lesson_title',
    workingPhraseKeys: ['com_ui_tool_activity_lesson_working'],
    completedKey: 'com_ui_tool_activity_lesson_completed',
  },
  school_files: {
    category: 'school_files',
    titleKey: 'com_ui_tool_activity_school_files_title',
    workingPhraseKeys: ['com_ui_tool_activity_school_files_working'],
    completedKey: 'com_ui_tool_activity_school_files_completed',
  },
  web_search: {
    category: 'web_search',
    titleKey: 'com_ui_tool_activity_web_search_title',
    workingPhraseKeys: [
      'com_ui_tool_activity_web_search_phrase_one',
      'com_ui_tool_activity_web_search_phrase_two',
    ],
    completedKey: 'com_ui_tool_activity_web_search_completed',
  },
  workspace: {
    category: 'workspace',
    titleKey: 'com_ui_tool_activity_workspace_title',
    workingPhraseKeys: ['com_ui_tool_activity_workspace_working'],
    completedKey: 'com_ui_tool_activity_workspace_completed',
  },
};

const normalizeToolIdentifier = (value: string) => value.trim().toLowerCase();

const includesAny = (value: string, identifiers: readonly string[]) =>
  identifiers.some((identifier) => value.includes(identifier));

/**
 * Maps internal MCP/action names to a stable, teacher-facing activity category.
 * New tools deliberately fall back to a safe, generic presentation.
 */
export function getToolActivityPresentation(
  functionName: string,
  mcpServerName: string,
): ToolActivityPresentation {
  const functionIdentifier = normalizeToolIdentifier(functionName);
  const serverIdentifier = normalizeToolIdentifier(mcpServerName);
  const identity = functionIdentifier + ' ' + serverIdentifier;

  if (
    includesAny(identity, [
      'image_generation',
      'generate_image',
      'generate_images',
      'create_image',
      'create_poster',
    ])
  ) {
    return presentations.image;
  }

  if (includesAny(serverIdentifier, ['downloadable-files-creation', 'downloadable_files'])) {
    return presentations.document;
  }

  if (
    includesAny(identity, [
      'create_document',
      'create_worksheet',
      'create_spreadsheet',
      'create_presentation',
      'generate_document',
      'generate_worksheet',
      'generate_file',
      'generate_pdf',
      'generate_docx',
    ])
  ) {
    return presentations.document;
  }

  if (includesAny(serverIdentifier, ['sharepoint', 'onedrive'])) {
    return presentations.school_files;
  }

  if (includesAny(serverIdentifier, ['outlook', 'teams'])) {
    return presentations.workspace;
  }

  if (includesAny(serverIdentifier, ['websearch', 'searxng'])) {
    return presentations.web_search;
  }

  if (includesAny(serverIdentifier, ['lesson-planning', 'lesson_planning'])) {
    return presentations.lesson;
  }

  if (includesAny(identity, ['knowledge', 'retrieval', 'file_search'])) {
    return presentations.knowledge;
  }

  if (includesAny(identity, ['analysis', 'analyze', 'assessment', 'data'])) {
    return presentations.analysis;
  }

  return presentations.generic;
}
