import { getToolActivityPresentation } from '../toolPresentation';

describe('getToolActivityPresentation', () => {
  it.each([
    ['generate_images', 'Image_Generation', 'image'],
    ['create_teacher_worksheet', 'Downloadable-Files-Creation', 'document'],
    ['search_sites', 'websearch', 'web_search'],
    ['search_sharepoint', 'sharepoint', 'school_files'],
    ['find_file', 'onedrive', 'school_files'],
    ['list_messages', 'outlook', 'workspace'],
    ['search_messages', 'teams', 'workspace'],
    ['lesson_generate', 'lesson-planning', 'lesson'],
    ['review_scores', 'assessment_tools', 'analysis'],
    ['unmapped_tool', 'new-server', 'generic'],
  ])('maps %s from %s to the %s presentation', (functionName, serverName, category) => {
    expect(getToolActivityPresentation(functionName, serverName).category).toBe(category);
  });
});
