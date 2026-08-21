import {
  agentHasLessonPlanningMcp,
  buildLessonPlanningLaunchPrompt,
  defaultLessonPlanningLaunchForm,
  isLessonPlanningAgentLabel,
  isLessonPlanningServerName,
  parseFrameworks,
} from '../lessonPlanningUtils';

describe('lessonPlanningUtils', () => {
  test('parseFrameworks splits comma and newline separated values', () => {
    expect(parseFrameworks('AVID, IB\nClassical')).toEqual(['AVID', 'IB', 'Classical']);
  });

  test('parseFrameworks supports selected checkbox values', () => {
    expect(parseFrameworks(['AVID', 'IB', 'AVID'])).toEqual(['AVID', 'IB']);
  });

  test('buildLessonPlanningLaunchPrompt includes selected values', () => {
    const values = {
      ...defaultLessonPlanningLaunchForm(),
      state: 'Florida',
      frameworks: ['AVID', 'IB'],
      subject: 'Math',
      gradeLevel: '5th Grade',
      lessonDuration: '60_min',
      teacherNotes: 'Focus on differentiation.',
    };

    const prompt = buildLessonPlanningLaunchPrompt(values);

    expect(prompt).toContain('Use only the lesson-planning MCP for this workflow.');
    expect(prompt).toContain('- State: Florida');
    expect(prompt).toContain('- School frameworks: AVID, IB');
    expect(prompt).toContain('- Subject: Math');
    expect(prompt).toContain('- Grade level: 5th Grade');
    expect(prompt).toContain('- Preferred lesson duration: 60 minutes (lesson_duration: 60_min)');
    expect(prompt).toContain('- Teacher notes: Focus on differentiation.');
    expect(prompt).toContain('Required tool order: call lesson_get_states');
    expect(prompt).toContain('your first assistant turn must complete this checklist');
    expect(prompt).toContain('lesson_get_grades, lesson_get_units');
    expect(prompt).toContain('use the exact selected state, subject, and grade_level value');
    expect(prompt).toContain(
      'do not proceed without a unit and do not call lesson_generate_suggestions',
    );
    expect(prompt).toContain('treat it as explicit user-provided lesson_duration');
    expect(prompt).toContain('Do not say you will fetch units unless you have already called');
  });

  test('isLessonPlanningServerName matches normalized server names', () => {
    expect(isLessonPlanningServerName(' lesson-planning ')).toBe(true);
    expect(isLessonPlanningServerName('LESSON-PLANNING')).toBe(true);
    expect(isLessonPlanningServerName('lesson_planning')).toBe(true);
    expect(isLessonPlanningServerName('lesson-planning-mcp')).toBe(true);
    expect(isLessonPlanningServerName('nei-lesson-planning-mcp')).toBe(true);
    expect(isLessonPlanningServerName('downloadable-files-creation')).toBe(false);
  });

  test('isLessonPlanningAgentLabel matches lesson planner agent names and descriptions', () => {
    expect(isLessonPlanningAgentLabel('Lesson Plan Builder')).toBe(true);
    expect(isLessonPlanningAgentLabel('NEI Lesson Planning')).toBe(true);
    expect(isLessonPlanningAgentLabel('Build standards-aligned lesson plans')).toBe(true);
    expect(isLessonPlanningAgentLabel('Worksheet Builder')).toBe(false);
  });

  test('agentHasLessonPlanningMcp matches server sentinel and individual MCP tool ids', () => {
    expect(
      agentHasLessonPlanningMcp(['sys__server__sys_mcp_lesson-planning'], 'lesson-planning'),
    ).toBe(true);
    expect(agentHasLessonPlanningMcp(['lesson_get_units'])).toBe(true);
    expect(agentHasLessonPlanningMcp([{ name: 'lesson_generate' }])).toBe(true);
    expect(agentHasLessonPlanningMcp(['lesson_get_states_mcp_lesson-planning'])).toBe(true);
    expect(agentHasLessonPlanningMcp(['lesson_get_states_mcp_other-server'])).toBe(false);
  });
});
