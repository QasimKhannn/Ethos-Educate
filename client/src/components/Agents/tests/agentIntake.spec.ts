import {
  buildAssessmentIntakePrompt,
  buildWorksheetIntakePrompt,
  createAssessmentIntakeValues,
  createWorksheetIntakeValues,
  getAgentIntakeTemplate,
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
});
