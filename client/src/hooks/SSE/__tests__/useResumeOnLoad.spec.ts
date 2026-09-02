import type { Agents } from 'librechat-data-provider';
import { matchesActiveSubmission } from '../useResumeOnLoad';

describe('matchesActiveSubmission', () => {
  it('recognizes the active job created by the current submission', () => {
    const resumeState = {
      userMessage: { messageId: 'user-message-id' },
    } as Agents.ResumeState;

    expect(matchesActiveSubmission('user-message-id', resumeState)).toBe(true);
  });

  it("does not block a resume for another conversation's active job", () => {
    const resumeState = {
      userMessage: { messageId: 'active-user-message-id' },
    } as Agents.ResumeState;

    expect(matchesActiveSubmission('stale-user-message-id', resumeState)).toBe(false);
  });
});
