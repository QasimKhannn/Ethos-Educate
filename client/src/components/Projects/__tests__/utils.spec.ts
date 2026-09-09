import { getProjectChatPath } from '../utils';

describe('getProjectChatPath', () => {
  it('creates a blank chat route scoped to the active project', () => {
    expect(getProjectChatPath('project-a')).toBe('/c/new?projectId=project-a');
  });

  it('keeps the project scope while queueing a first prompt', () => {
    expect(getProjectChatPath('project-b', 'Draft a family newsletter')).toBe(
      '/c/new?projectId=project-b&q=Draft+a+family+newsletter&submit=true',
    );
  });

  it('does not reuse another project when switching projects', () => {
    expect(getProjectChatPath('project-a')).not.toBe(getProjectChatPath('project-b'));
  });
});
