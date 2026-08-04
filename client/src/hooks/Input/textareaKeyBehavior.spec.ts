import { shouldInsertNewlineOnEnter } from './textareaKeyBehavior';

const defaultBehavior = {
  ctrlKey: false,
  enterToSend: true,
  isSmallScreen: false,
  metaKey: false,
  shiftKey: false,
};

describe('shouldInsertNewlineOnEnter', () => {
  it('inserts a newline for plain Enter on mobile', () => {
    expect(
      shouldInsertNewlineOnEnter({
        ...defaultBehavior,
        isSmallScreen: true,
      }),
    ).toBe(true);
  });

  it('preserves desktop Enter-to-send', () => {
    expect(shouldInsertNewlineOnEnter(defaultBehavior)).toBe(false);
  });

  it('leaves Shift+Enter to the textarea', () => {
    expect(
      shouldInsertNewlineOnEnter({
        ...defaultBehavior,
        isSmallScreen: true,
        shiftKey: true,
      }),
    ).toBe(false);
  });

  it('preserves Ctrl+Enter and Cmd+Enter submission', () => {
    expect(
      shouldInsertNewlineOnEnter({
        ...defaultBehavior,
        ctrlKey: true,
        isSmallScreen: true,
      }),
    ).toBe(false);
    expect(
      shouldInsertNewlineOnEnter({
        ...defaultBehavior,
        isSmallScreen: true,
        metaKey: true,
      }),
    ).toBe(false);
  });

  it('respects the Enter-to-send preference when disabled', () => {
    expect(
      shouldInsertNewlineOnEnter({
        ...defaultBehavior,
        enterToSend: false,
      }),
    ).toBe(true);
  });
});
