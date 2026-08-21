import { Constants } from 'librechat-data-provider';

export const LESSON_PLANNING_SERVER_NAME = 'lesson-planning';
const LESSON_PLANNING_SERVER_ALIASES = [
  LESSON_PLANNING_SERVER_NAME,
  'lesson_planning',
  'lesson-planning-mcp',
  'nei-lesson-planning',
  'nei-lesson-planning-mcp',
];
const LESSON_PLANNING_TOOL_PREFIX = 'lesson_';

export interface LessonPlanningOption {
  value: string;
  label: string;
}

export const LESSON_PLANNING_STATE_OPTIONS = ['Florida'];
export const LESSON_PLANNING_FRAMEWORK_OPTIONS = ['AVID', 'IB', 'Classical'];
export const LESSON_PLANNING_SUBJECT_OPTIONS = [
  'ELA',
  'Math',
  'Science',
  'Social Studies',
  'Specials',
  'Electives',
];
export const LESSON_PLANNING_GRADE_OPTIONS: LessonPlanningOption[] = [
  { value: 'Kinder', label: 'Kindergarten' },
  { value: '1st Grade', label: '1st Grade' },
  { value: '2nd Grade', label: '2nd Grade' },
  { value: '3rd Grade', label: '3rd Grade' },
  { value: '4th Grade', label: '4th Grade' },
  { value: '5th Grade', label: '5th Grade' },
  { value: '6th Grade', label: '6th Grade' },
  { value: '7th Grade', label: '7th Grade' },
  { value: '8th Grade', label: '8th Grade' },
  { value: 'Algebra 1', label: 'Algebra 1' },
  { value: 'Geometry', label: 'Geometry' },
  { value: '9th Grade', label: '9th Grade' },
  { value: '10th Grade', label: '10th Grade' },
  { value: '11th Grade', label: '11th Grade' },
  { value: '12th Grade', label: '12th Grade' },
];
export const LESSON_PLANNING_DURATION_OPTIONS: LessonPlanningOption[] = [
  { value: '30_min', label: '30 minutes' },
  { value: '45_min', label: '45 minutes' },
  { value: '60_min', label: '60 minutes' },
  { value: '90_min', label: '90 minutes' },
];
export const LESSON_PLANNING_SCOPE_OPTIONS: LessonPlanningOption[] = [
  { value: 'one_day', label: 'One-day lesson' },
  { value: 'five_day', label: 'Five-day sequence' },
  { value: 'full_unit', label: 'Full unit plan' },
];

export interface LessonPlanningLaunchForm {
  state: string;
  frameworks: string[];
  subject: string;
  gradeLevel: string;
  lessonDuration: string;
  lessonScope: string;
  teacherNotes: string;
}

export const defaultLessonPlanningLaunchForm = (): LessonPlanningLaunchForm => ({
  state: '',
  frameworks: [],
  subject: '',
  gradeLevel: '',
  lessonDuration: '',
  lessonScope: 'five_day',
  teacherNotes: '',
});

export function normalizeServerName(value: string): string {
  return value.trim().toLowerCase();
}

export function isLessonPlanningServerName(value: string): boolean {
  const normalizedValue = normalizeServerName(value).replace(/_/g, '-');
  return LESSON_PLANNING_SERVER_ALIASES.some(
    (serverName) => normalizeServerName(serverName).replace(/_/g, '-') === normalizedValue,
  );
}

export function isLessonPlanningAgentLabel(...values: unknown[]): boolean {
  const normalizedText = values
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  return normalizedText.includes('lesson plan');
}

export function parseFrameworks(value: string | string[]): string[] {
  const values = Array.isArray(value) ? value : value.split(/[\n,]/);

  return values
    .map((item) => item.trim())
    .filter((item, index, items) => Boolean(item) && items.indexOf(item) === index);
}

export type LessonPlanningAgentTool =
  | string
  | {
      name?: string;
      tool_id?: string;
    };

function toolReferenceValue(tool: LessonPlanningAgentTool): string {
  if (typeof tool === 'string') {
    return tool;
  }
  return tool.tool_id ?? tool.name ?? '';
}

export function isLessonPlanningAgentTool(
  tool: LessonPlanningAgentTool,
  serverName = LESSON_PLANNING_SERVER_NAME,
): boolean {
  const value = normalizeServerName(toolReferenceValue(tool));
  const normalizedServerName = normalizeServerName(serverName);

  if (!value) {
    return false;
  }

  if (
    value.startsWith(LESSON_PLANNING_TOOL_PREFIX) &&
    !value.includes(normalizeServerName(Constants.mcp_delimiter))
  ) {
    return true;
  }

  const serverToolIds = [
    normalizedServerName,
    `${Constants.mcp_prefix}${normalizedServerName}`,
    `${Constants.mcp_server}${Constants.mcp_delimiter}${normalizedServerName}`,
    `${Constants.mcp_all}${Constants.mcp_delimiter}${normalizedServerName}`,
  ].map(normalizeServerName);

  return (
    serverToolIds.includes(value) ||
    value.endsWith(normalizeServerName(`${Constants.mcp_delimiter}${normalizedServerName}`))
  );
}

export function agentHasLessonPlanningMcp(
  tools: LessonPlanningAgentTool[] | undefined,
  serverName = LESSON_PLANNING_SERVER_NAME,
): boolean {
  return (tools ?? []).some((tool) => isLessonPlanningAgentTool(tool, serverName));
}

function durationLabel(value: string): string {
  return LESSON_PLANNING_DURATION_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function gradeLevelLabel(value: string): string {
  return LESSON_PLANNING_GRADE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function lessonScopeLabel(value: string): string {
  return LESSON_PLANNING_SCOPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function buildLessonPlanningLaunchPrompt(values: LessonPlanningLaunchForm): string {
  const frameworks = parseFrameworks(values.frameworks);
  const selections: string[] = [];

  if (values.state.trim()) {
    selections.push(`- State: ${values.state.trim()}`);
  }
  if (frameworks.length > 0) {
    selections.push(`- School frameworks: ${frameworks.join(', ')}`);
  }
  if (values.subject.trim()) {
    selections.push(`- Subject: ${values.subject.trim()}`);
  }
  if (values.gradeLevel.trim()) {
    const gradeValue = values.gradeLevel.trim();
    const gradeLabel = gradeLevelLabel(gradeValue);
    selections.push(
      gradeLabel === gradeValue
        ? `- Grade level: ${gradeValue}`
        : `- Grade level: ${gradeValue} (display: ${gradeLabel})`,
    );
  }
  if (values.lessonDuration.trim()) {
    const durationValue = values.lessonDuration.trim();
    selections.push(
      `- Preferred lesson duration: ${durationLabel(durationValue)} (lesson_duration: ${durationValue})`,
    );
  }
  if (values.lessonScope.trim()) {
    const scopeValue = values.lessonScope.trim();
    selections.push(
      `- Lesson scope: ${lessonScopeLabel(scopeValue)} (lesson_scope: ${scopeValue})`,
    );
  }
  if (values.teacherNotes.trim()) {
    selections.push(`- Teacher notes: ${values.teacherNotes.trim()}`);
  }

  const currentSelections = selections.length > 0 ? selections.join('\n') : '- No selections yet.';

  return [
    'I want to create a lesson plan.',
    'Use only the lesson-planning MCP for this workflow.',
    'Validate prefilled values by actually calling the MCP tools before marking them valid.',
    'Do not validate state, framework, subject, or grade level from memory or general knowledge.',
    'Required tool order: call lesson_get_states and lesson_get_frameworks, then call lesson_get_subjects with the selected state, then call lesson_get_grades with the selected state and subject.',
    'If state, subject, and grade level are present, your first assistant turn must complete this checklist before any prose reply: lesson_get_states, lesson_get_frameworks, lesson_get_subjects, lesson_get_grades, lesson_get_units.',
    'When calling lesson_get_units, use the exact selected state, subject, and grade_level value validated by lesson_get_grades.',
    'Only after lesson_get_units returns should you reply with the returned unit choices. Do not say you will fetch units unless you have already called lesson_get_units.',
    'After lesson_get_units returns, ask me to choose one returned unit in chat unless the subject is Specials or Electives and no units are returned.',
    'If lesson_get_units returns no units for any subject other than Specials or Electives, do not proceed without a unit and do not call lesson_generate_suggestions. Retry lesson_get_units once with the exact grade value from lesson_get_grades. If it is still empty, stop and report the exact state, subject, and grade_level arguments used.',
    'If Preferred lesson duration is listed below, treat it as explicit user-provided lesson_duration for lesson_generate. Do not ask for duration again unless it is blank or invalid.',
    'If Lesson scope is listed below, treat it as explicit user-provided lesson_scope for lesson_generate. Do not ask for lesson scope again unless it is blank or invalid.',
    'When calling lesson_generate, pass use_supporting_resources=true so available test specs, BlueBook-style guidance, and pacing calendars can be used when relevant.',
    'If any field below is blank, ask me for that choice next and keep it to one decision at a time.',
    '',
    'Current known selections:',
    currentSelections,
    '',
    'When the lesson plan is ready, show me the direct download link.',
  ].join('\n');
}
