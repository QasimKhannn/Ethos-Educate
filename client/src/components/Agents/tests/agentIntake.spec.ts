import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildAssessmentIntakePrompt,
  buildPresentationIntakePrompt,
  buildWorksheetIntakePrompt,
  createAssessmentIntakeValues,
  createPresentationIntakeValues,
  createWorksheetIntakeValues,
  getAgentIntakeTemplate,
  presentationTemplates,
} from '../agentIntake';
import type { Agent } from 'librechat-data-provider';

describe('agent intake prompt builders', () => {
  it('preserves worksheet requirements in the agent request', () => {
    const values = createWorksheetIntakeValues();
    Object.assign(values, {
      topic: 'Equivalent fractions',
      grade: 'Grade 4',
      objective: 'Recognize equivalent fractions using visual models',
      questionCount: '12',
      questionTypes: ['Multiple choice', 'Short answer'],
      difficulty: 'Mixed',
      includeAnswerKey: 'yes',
      specificContent: 'Use halves, thirds, fourths, and sixths.',
    });

    expect(buildWorksheetIntakePrompt(values)).toContain('Worksheet topic: Equivalent fractions');
    expect(buildWorksheetIntakePrompt(values)).toContain('Grade or age: Grade 4');
    expect(buildWorksheetIntakePrompt(values)).toContain(
      'Question types: Multiple choice, Short answer',
    );
    expect(buildWorksheetIntakePrompt(values)).toContain('Include a separate answer key');
    expect(buildWorksheetIntakePrompt(values)).toContain(
      'Do not add tracing, copying, handwriting, or word-writing practice unless the teacher explicitly requested it above.',
    );
  });

  it('only adds versioning requirements when multiple assessment versions are requested', () => {
    const values = createAssessmentIntakeValues();
    Object.assign(values, {
      topic: 'Cell structures',
      grade: 'Grade 7',
      assessmentType: 'Quiz',
      versionCount: '3',
      versionMethods: ['Shuffle question order', 'Create different but equivalent questions'],
      answerKeyMode: 'One answer key for each version',
    });

    const prompt = buildAssessmentIntakePrompt(values);

    expect(prompt).toContain('Number of versions: 3');
    expect(prompt).toContain(
      'How versions should differ: Shuffle question order, Create different but equivalent questions',
    );
    expect(prompt).toContain('Answer keys: One answer key for each version');
  });

  it('keeps teacher forms available for the current unconfigured Ethos agents', () => {
    expect(getAgentIntakeTemplate({ name: 'Worksheet Generator' } as Agent)).toBe('worksheet');
    expect(getAgentIntakeTemplate({ name: 'Assessment & Quiz Builder' } as Agent)).toBe(
      'assessment',
    );
  });

  it('preserves a selected named PowerPoint template for the deck creator tool', () => {
    const values = createPresentationIntakeValues();
    values.selectedTemplateId = '6-8:prism';

    const prompt = buildPresentationIntakePrompt(values);

    expect(presentationTemplates).toHaveLength(28);
    expect(prompt).toContain('Selected template: 6-8 Prism');
    expect(prompt).toContain('template_id: 6-8:prism');
    expect(prompt).toContain('grade_band: 6-8');
    expect(prompt).toContain('deck_type: teacher_lesson');
    expect(prompt).toContain('using the selected template_id, grade_band, and deck_type');
  });

  it('keeps one local preview for every distinct PowerPoint template', () => {
    const templateIds = presentationTemplates.map((template) => template.templateId);
    const previewImages = presentationTemplates.map((template) => template.previewImage);

    expect(templateIds).toHaveLength(28);
    expect(new Set(templateIds).size).toBe(templateIds.length);
    expect(new Set(previewImages).size).toBe(previewImages.length);

    for (const previewImage of previewImages) {
      const previewPath = resolve(__dirname, '../../../../public', previewImage.slice(1));
      expect(existsSync(previewPath)).toBe(true);
    }
  });
});
