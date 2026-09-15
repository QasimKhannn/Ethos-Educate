import { act, renderHook } from '@testing-library/react';

import useSmoothStreamingText, {
  getNextWordRevealIndex,
  hasInitialStreamingText,
} from './useSmoothStreamingText';

describe('streaming text presentation', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits for two visible words before replacing the thinking state', () => {
    expect(hasInitialStreamingText('')).toBe(false);
    expect(hasInitialStreamingText('Hello')).toBe(false);
    expect(hasInitialStreamingText('Hello there')).toBe(true);
  });

  it('advances by complete words', () => {
    const text = 'Hello there, how can I help?';
    const firstIndex = getNextWordRevealIndex(text, 0, 2);
    const secondIndex = getNextWordRevealIndex(text, firstIndex, 2);

    expect(text.slice(0, firstIndex)).toBe('Hello there, ');
    expect(text.slice(0, secondIndex)).toBe('Hello there, how can ');
  });

  it('continues a smooth reveal when a completed response arrives in one burst', () => {
    jest.useFakeTimers();
    const text = 'One two three four five six';
    const { result, rerender } = renderHook(
      ({ animate }) => useSmoothStreamingText(text, animate),
      { initialProps: { animate: true } },
    );

    expect(result.current).toBe('One two ');
    rerender({ animate: false });

    act(() => {
      jest.advanceTimersByTime(160);
    });

    expect(result.current).toBe(text);
  });
});
