import type { Agent } from 'librechat-data-provider';

export type IntakeTemplate = 'worksheet' | 'assessment' | 'presentation';

export const gradeOptions = [
  'Preschool',
  'Pre-K',
  'Kindergarten',
  ...Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`),
  'Other',
];

export const worksheetQuestionTypes = [
  'Multiple choice',
  'Fill in the blank',
  'True / false',
  'Matching',
  'Short answer',
  'Long response',
];

export const assessmentQuestionTypes = [
  'Multiple choice',
  'Select all that apply',
  'Fill in the blank',
  'True / false',
  'Matching',
  'Short answer',
  'Extended response',
];

export const versionMethods = [
  'Shuffle question order',
  'Shuffle answer choices',
  'Use different numbers or values',
  'Create different but equivalent questions',
  'Change examples or scenarios',
  'Change reading passages or source material',
  'Keep written-response prompts the same',
];

export const presentationDeckTypes = [
  {
    value: 'teacher_lesson',
    label: 'Teacher Lesson',
    description:
      'Full lesson flow with objective, warm-up, teaching, guided practice, quick check, independent work, and exit ticket.',
  },
  {
    value: 'review_assessment',
    label: 'Review Assessment',
    description:
      'Review/checkpoint flow with key concepts, practice, quick check, independent response, and reteach notes.',
  },
  {
    value: 'inquiry_project',
    label: 'Inquiry Project',
    description:
      'Investigation/project flow with question launch, exploration, organizer, collaboration, share-out, and reflection.',
  },
] as const;

const presentationGradeBands = [
  {
    value: 'K-2',
    label: 'K-2',
    description: 'Large text, simple language, and visual-heavy pacing.',
    previewSlug: 'k-2',
  },
  {
    value: '3-5',
    label: '3-5',
    description: 'Student-friendly explanations, examples, and checks for understanding.',
    previewSlug: 'grades-3-5',
  },
  {
    value: '6-8',
    label: '6-8',
    description: 'Middle-grade vocabulary, reasoning, discussion, and application tasks.',
    previewSlug: 'grades-6-8',
  },
  {
    value: '9-12',
    label: '9-12',
    description: 'Concise academic style with analysis, evidence, and synthesis prompts.',
    previewSlug: 'grades-9-12',
  },
] as const;

const classroomFlowTemplates = presentationGradeBands.flatMap((gradeBand) =>
  presentationDeckTypes.map((deckType) => ({
    templateId: `${gradeBand.value}:${deckType.value}`,
    gradeBand: gradeBand.value,
    deckType: deckType.value,
    label: `${gradeBand.label} ${deckType.label}`,
    deckLabel: deckType.label,
    gradeDescription: gradeBand.description,
    description: deckType.description,
    previewImage: `/assets/presentation-templates/${gradeBand.previewSlug}-${deckType.value.replace(/_/g, '-')}.png`,
    slideCount: 11,
  })),
);

const archivePresentationTemplates = [
  {
    templateId: 'K-2:primary_blocks_teacher_lesson',
    gradeBand: 'K-2',
    deckType: 'teacher_lesson',
    label: 'K-2 Primary Blocks Lesson',
    deckLabel: 'Primary Blocks Lesson',
    gradeDescription: 'Large text, simple language, and visual-heavy pacing.',
    description: 'A bright primary-color lesson deck with playful blocks and scalloped borders.',
    previewImage: '/assets/presentation-templates/k-2-primary-blocks-teacher-lesson.png',
    slideCount: 11,
  },
  {
    templateId: 'K-2:primary_blocks_review_assessment',
    gradeBand: 'K-2',
    deckType: 'review_assessment',
    label: 'K-2 Primary Blocks Review',
    deckLabel: 'Primary Blocks Review',
    gradeDescription: 'Large text, simple language, and visual-heavy pacing.',
    description: 'A bright primary-color review deck with playful blocks and scalloped borders.',
    previewImage: '/assets/presentation-templates/k-2-primary-blocks-review-assessment.png',
    slideCount: 11,
  },
  {
    templateId: 'K-2:primary_blocks_inquiry_project',
    gradeBand: 'K-2',
    deckType: 'inquiry_project',
    label: 'K-2 Primary Blocks Inquiry',
    deckLabel: 'Primary Blocks Inquiry',
    gradeDescription: 'Large text, simple language, and visual-heavy pacing.',
    description: 'A bright primary-color inquiry deck with playful blocks and scalloped borders.',
    previewImage: '/assets/presentation-templates/k-2-primary-blocks-inquiry-project.png',
    slideCount: 11,
  },
  {
    templateId: '3-5:space_explorer_teacher_lesson',
    gradeBand: '3-5',
    deckType: 'teacher_lesson',
    label: '3-5 Space Explorer Lesson',
    deckLabel: 'Space Explorer Lesson',
    gradeDescription: 'Student-friendly explanations, examples, and checks for understanding.',
    description: 'A navy space-explorer lesson deck with planets, stars, and bold classroom prompts.',
    previewImage: '/assets/presentation-templates/grades-3-5-space-explorer-teacher-lesson.png',
    slideCount: 11,
  },
  {
    templateId: '3-5:space_explorer_review_assessment',
    gradeBand: '3-5',
    deckType: 'review_assessment',
    label: '3-5 Space Explorer Review',
    deckLabel: 'Space Explorer Review',
    gradeDescription: 'Student-friendly explanations, examples, and checks for understanding.',
    description: 'A navy space-explorer review deck with planets, stars, and bold classroom prompts.',
    previewImage: '/assets/presentation-templates/grades-3-5-space-explorer-review-assessment.png',
    slideCount: 11,
  },
  {
    templateId: '3-5:space_explorer_inquiry_project',
    gradeBand: '3-5',
    deckType: 'inquiry_project',
    label: '3-5 Space Explorer Inquiry',
    deckLabel: 'Space Explorer Inquiry',
    gradeDescription: 'Student-friendly explanations, examples, and checks for understanding.',
    description: 'A navy space-explorer inquiry deck with planets, stars, and bold classroom prompts.',
    previewImage: '/assets/presentation-templates/grades-3-5-space-explorer-inquiry-project.png',
    slideCount: 11,
  },
  {
    templateId: '6-8:grid_studio_teacher_lesson',
    gradeBand: '6-8',
    deckType: 'teacher_lesson',
    label: '6-8 Grid Studio Lesson',
    deckLabel: 'Grid Studio Lesson',
    gradeDescription: 'Middle-grade vocabulary, reasoning, discussion, and application tasks.',
    description: 'A graph-paper lesson deck with taped-note accents and high-contrast headings.',
    previewImage: '/assets/presentation-templates/grades-6-8-grid-studio-teacher-lesson.png',
    slideCount: 11,
  },
  {
    templateId: '6-8:grid_studio_review_assessment',
    gradeBand: '6-8',
    deckType: 'review_assessment',
    label: '6-8 Grid Studio Review',
    deckLabel: 'Grid Studio Review',
    gradeDescription: 'Middle-grade vocabulary, reasoning, discussion, and application tasks.',
    description: 'A graph-paper review deck with taped-note accents and high-contrast headings.',
    previewImage: '/assets/presentation-templates/grades-6-8-grid-studio-review-assessment.png',
    slideCount: 11,
  },
  {
    templateId: '6-8:grid_studio_inquiry_project',
    gradeBand: '6-8',
    deckType: 'inquiry_project',
    label: '6-8 Grid Studio Inquiry',
    deckLabel: 'Grid Studio Inquiry',
    gradeDescription: 'Middle-grade vocabulary, reasoning, discussion, and application tasks.',
    description: 'A graph-paper inquiry deck with taped-note accents and high-contrast headings.',
    previewImage: '/assets/presentation-templates/grades-6-8-grid-studio-inquiry-project.png',
    slideCount: 11,
  },
  {
    templateId: '9-12:editorial_teacher_lesson',
    gradeBand: '9-12',
    deckType: 'teacher_lesson',
    label: '9-12 Editorial Lesson',
    deckLabel: 'Editorial Lesson',
    gradeDescription: 'Concise academic style with analysis, evidence, and synthesis prompts.',
    description: 'A refined editorial lesson deck with a restrained academic black-and-white style.',
    previewImage: '/assets/presentation-templates/grades-9-12-editorial-teacher-lesson.png',
    slideCount: 11,
  },
  {
    templateId: '9-12:editorial_review_assessment',
    gradeBand: '9-12',
    deckType: 'review_assessment',
    label: '9-12 Editorial Review',
    deckLabel: 'Editorial Review',
    gradeDescription: 'Concise academic style with analysis, evidence, and synthesis prompts.',
    description: 'A refined editorial review deck with a restrained academic black-and-white style.',
    previewImage: '/assets/presentation-templates/grades-9-12-editorial-review-assessment.png',
    slideCount: 11,
  },
  {
    templateId: '9-12:editorial_inquiry_project',
    gradeBand: '9-12',
    deckType: 'inquiry_project',
    label: '9-12 Editorial Inquiry',
    deckLabel: 'Editorial Inquiry',
    gradeDescription: 'Concise academic style with analysis, evidence, and synthesis prompts.',
    description: 'A refined editorial inquiry deck with a restrained academic black-and-white style.',
    previewImage: '/assets/presentation-templates/grades-9-12-editorial-inquiry-project.png',
    slideCount: 11,
  },
] as const;

const namedPresentationTemplates = [
  {
    templateId: 'K-2:sunny_day',
    gradeBand: 'K-2',
    deckType: 'teacher_lesson',
    label: 'K-2 Sunny Day',
    deckLabel: 'Sunny Day',
    gradeDescription: 'Large text, simple language, and visual-heavy pacing.',
    description: 'Bright, playful lesson slides with an easy-to-read classroom feel.',
    previewImage: '/assets/presentation-templates/k-2-sunny-day.png',
    slideCount: 11,
  },
  {
    templateId: '3-5:explorers_trail',
    gradeBand: '3-5',
    deckType: 'teacher_lesson',
    label: "3-5 Explorer's Trail",
    deckLabel: "Explorer's Trail",
    gradeDescription: 'Student-friendly explanations, examples, and checks for understanding.',
    description: 'An energetic elementary lesson theme with explorer-inspired shapes and colors.',
    previewImage: '/assets/presentation-templates/grades-3-5-explorers-trail.png',
    slideCount: 11,
  },
  {
    templateId: '6-8:prism',
    gradeBand: '6-8',
    deckType: 'teacher_lesson',
    label: '6-8 Prism',
    deckLabel: 'Prism',
    gradeDescription: 'Middle-grade vocabulary, reasoning, discussion, and application tasks.',
    description: 'A bold middle-school lesson theme with high-contrast geometric accents.',
    previewImage: '/assets/presentation-templates/grades-6-8-prism.png',
    slideCount: 11,
  },
  {
    templateId: '9-12:meridian',
    gradeBand: '9-12',
    deckType: 'teacher_lesson',
    label: '9-12 Meridian',
    deckLabel: 'Meridian',
    gradeDescription: 'Concise academic style with analysis, evidence, and synthesis prompts.',
    description: 'A polished secondary lesson theme with a focused academic presentation style.',
    previewImage: '/assets/presentation-templates/grades-9-12-meridian.png',
    slideCount: 11,
  },
] as const;

export const presentationTemplates = [
  ...archivePresentationTemplates,
  ...classroomFlowTemplates,
  ...namedPresentationTemplates,
];

export type WorksheetIntakeValues = {
  topic: string;
  grade: string;
  customGrade: string;
  objective: string;
  questionCount: string;
  questionTypes: string[];
  otherQuestionType: string;
  difficulty: string;
  otherDifficulty: string;
  includeAnswerKey: 'yes' | 'no';
  specificContent: string;
  notes: string;
};

export type AssessmentIntakeValues = {
  topic: string;
  grade: string;
  customGrade: string;
  objective: string;
  sourceMaterial: string;
  assessmentType: string;
  questionCount: string;
  questionTypes: string[];
  otherQuestionType: string;
  difficultyDistribution: string;
  versionCount: string;
  versionMethods: string[];
  otherVersionMethod: string;
  equivalentDifficulty: string;
  sharedObjectives: string;
  versionLabels: string;
  customVersionLabels: string;
  answerKeyMode: string;
  notes: string;
};

export type PresentationIntakeValues = {
  selectedTemplateId: string;
  templateView: 'gallery' | 'list';
};

export const createWorksheetIntakeValues = (): WorksheetIntakeValues => ({
  topic: '',
  grade: '',
  customGrade: '',
  objective: '',
  questionCount: '10',
  questionTypes: [],
  otherQuestionType: '',
  difficulty: 'Grade-level',
  otherDifficulty: '',
  includeAnswerKey: 'yes',
  specificContent: '',
  notes: '',
});

export const createAssessmentIntakeValues = (): AssessmentIntakeValues => ({
  topic: '',
  grade: '',
  customGrade: '',
  objective: '',
  sourceMaterial: '',
  assessmentType: 'Quiz',
  questionCount: '10',
  questionTypes: [],
  otherQuestionType: '',
  difficultyDistribution: 'Mostly grade-level with a few challenging questions',
  versionCount: '1',
  versionMethods: [],
  otherVersionMethod: '',
  equivalentDifficulty: 'Yes',
  sharedObjectives: 'Yes',
  versionLabels: 'Version A, B, C, D, E',
  customVersionLabels: '',
  answerKeyMode: 'One answer key for each version',
  notes: '',
});

export const createPresentationIntakeValues = (): PresentationIntakeValues => ({
  selectedTemplateId: '3-5:teacher_lesson',
  templateView: 'gallery',
});

export function getAgentIntakeTemplate(agent?: Agent | null): IntakeTemplate | null {
  const template = agent?.intake_form?.template;
  if (template === 'worksheet' || template === 'assessment' || template === 'presentation') {
    return template;
  }

  // Existing Ethos agents predate the saved intake_form field. Keep their
  // teacher forms available until the records are saved through Agent Builder.
  const name = agent?.name?.trim().toLowerCase();
  if (name === 'worksheet generator') {
    return 'worksheet';
  }
  if (name === 'assessment & quiz builder') {
    return 'assessment';
  }
  if (name === 'powerpoint presentation creator') {
    return 'presentation';
  }

  return null;
}

const addLine = (lines: string[], label: string, value?: string) => {
  const trimmedValue = value?.trim();
  if (trimmedValue) {
    lines.push(`${label}: ${trimmedValue}`);
  }
};

const selectedGrade = (grade: string, customGrade: string) =>
  grade === 'Other' ? customGrade.trim() : grade;

const listWithOther = (selected: string[], other: string) =>
  [...selected, ...(other.trim() ? [other.trim()] : [])].join(', ');

export function buildWorksheetIntakePrompt(values: WorksheetIntakeValues): string {
  const lines = ['Create a classroom-ready worksheet from this teacher request.'];

  addLine(lines, 'Worksheet topic', values.topic);
  addLine(lines, 'Grade or age', selectedGrade(values.grade, values.customGrade));
  addLine(lines, 'Learning objective or skill', values.objective);
  addLine(lines, 'Number of questions', values.questionCount);
  addLine(lines, 'Question types', listWithOther(values.questionTypes, values.otherQuestionType));
  addLine(
    lines,
    'Difficulty level',
    values.difficulty === 'Other' ? values.otherDifficulty : values.difficulty,
  );
  lines.push(
    `Answer key: ${values.includeAnswerKey === 'yes' ? 'Include a separate answer key' : 'Do not include an answer key'}`,
  );
  addLine(lines, 'Specific content, vocabulary, or skills', values.specificContent);
  addLine(lines, 'Additional teacher notes', values.notes);
  lines.push(
    'Do not add tracing, copying, handwriting, or word-writing practice unless the teacher explicitly requested it above.',
  );
  lines.push(
    'Treat every supplied item as a requirement and return the requested student-ready files.',
  );

  return lines.join('\n');
}

export function buildAssessmentIntakePrompt(values: AssessmentIntakeValues): string {
  const lines = ['Create a classroom-ready assessment from this teacher request.'];

  addLine(lines, 'Assessment topic', values.topic);
  addLine(lines, 'Grade or age', selectedGrade(values.grade, values.customGrade));
  addLine(lines, 'Learning objective or standard', values.objective);
  addLine(lines, 'Source material or content to assess', values.sourceMaterial);
  addLine(lines, 'Assessment type', values.assessmentType);
  addLine(lines, 'Number of questions', values.questionCount);
  addLine(lines, 'Question types', listWithOther(values.questionTypes, values.otherQuestionType));
  addLine(lines, 'Difficulty distribution', values.difficultyDistribution);
  addLine(lines, 'Number of versions', values.versionCount);

  if (Number(values.versionCount) > 1) {
    addLine(
      lines,
      'How versions should differ',
      listWithOther(values.versionMethods, values.otherVersionMethod),
    );
    addLine(lines, 'Keep all versions equivalent in difficulty', values.equivalentDifficulty);
    addLine(lines, 'Keep the same learning objectives across versions', values.sharedObjectives);
    addLine(
      lines,
      'Version labels',
      values.versionLabels === 'Custom' ? values.customVersionLabels : values.versionLabels,
    );
  }

  addLine(lines, 'Answer keys', values.answerKeyMode);
  addLine(lines, 'Additional teacher notes', values.notes);
  lines.push(
    'Treat every supplied item as a requirement. Include standards-aligned questions, defensible distractors, and teacher materials requested above.',
  );

  return lines.join('\n');
}

export function buildPresentationIntakePrompt(values: PresentationIntakeValues): string {
  const selectedTemplate =
    presentationTemplates.find((template) => template.templateId === values.selectedTemplateId) ??
    presentationTemplates[0];
  const lines = [
    'I selected a PowerPoint template for this presentation creator chat.',
    `Selected template: ${selectedTemplate.label}`,
    `template_id: ${selectedTemplate.templateId}`,
    `grade_band: ${selectedTemplate.gradeBand}`,
    `deck_type: ${selectedTemplate.deckType}`,
    'Do not create a PPTX from this template selection alone.',
    'Ask me what presentation I want to create if I have not already provided the topic or content.',
    'After I provide the presentation request, draft the complete slide-by-slide content in chat for teacher review before creating the PPTX.',
    'Only after I approve the draft, call presentation_deck_creator with content_status="teacher_approved" using the selected template_id, grade_band, and deck_type.',
  ];

  return lines.join('\n');
}
