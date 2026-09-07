import {
  agentIntakeLaunchMaxAgeMs,
  createAgentIntakeLaunch,
  getAgentIntakeLaunch,
  markAgentIntakeLaunchSubmitted,
} from '../agentIntakeLaunch';

describe('agent intake launch', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('stores the intake prompt in session storage and returns an opaque launch id', () => {
    const launch = createAgentIntakeLaunch({
      agentId: 'worksheet-agent',
      template: 'worksheet',
      prompt: 'Create a Grade 3 fractions worksheet.',
    });

    expect(launch).not.toBeNull();
    expect(launch?.id).toBeTruthy();
    expect(launch?.prompt).toBe('Create a Grade 3 fractions worksheet.');
    expect(getAgentIntakeLaunch(launch?.id ?? null)).toEqual(launch);
  });

  it('marks a queued launch as submitted to prevent duplicate auto-submission', () => {
    const launch = createAgentIntakeLaunch({
      agentId: 'assessment-agent',
      template: 'assessment',
      prompt: 'Create a Grade 7 science assessment.',
    });

    expect(markAgentIntakeLaunchSubmitted(launch?.id ?? null)).toBe(true);
    expect(getAgentIntakeLaunch(launch?.id ?? null)?.status).toBe('submitted');
  });

  it('removes an expired launch instead of restoring an old form handoff', () => {
    const launch = createAgentIntakeLaunch({
      agentId: 'presentation-agent',
      template: 'presentation',
      prompt: 'Create a Grade 5 water conservation presentation.',
    });
    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue((launch?.createdAt ?? 0) + agentIntakeLaunchMaxAgeMs + 1);

    expect(getAgentIntakeLaunch(launch?.id ?? null)).toBeNull();

    nowSpy.mockRestore();
  });
});
