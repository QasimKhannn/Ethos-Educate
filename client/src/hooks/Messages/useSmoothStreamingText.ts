import { useCallback, useEffect, useRef, useState } from 'react';

const INITIAL_WORD_COUNT = 2;
const REVEAL_INTERVAL_MS = 32;
const WHITESPACE_PATTERN = /\s/u;

const getWordsPerInterval = (remainingCharacters: number): number => {
  if (remainingCharacters > 1600) {
    return 12;
  }
  if (remainingCharacters > 800) {
    return 8;
  }
  if (remainingCharacters > 320) {
    return 4;
  }
  if (remainingCharacters > 120) {
    return 2;
  }
  return 1;
};

export const getNextWordRevealIndex = (
  text: string,
  currentIndex: number,
  wordCount: number,
): number => {
  let index = Math.min(Math.max(currentIndex, 0), text.length);
  let revealedWords = 0;

  while (index < text.length && revealedWords < wordCount) {
    while (index < text.length && WHITESPACE_PATTERN.test(text[index])) {
      index++;
    }
    while (index < text.length && !WHITESPACE_PATTERN.test(text[index])) {
      index++;
    }
    revealedWords++;
  }

  while (index < text.length && WHITESPACE_PATTERN.test(text[index])) {
    index++;
  }

  return index;
};

export const hasInitialStreamingText = (text: string): boolean => {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return false;
  }

  const firstWordEnd = getNextWordRevealIndex(trimmedText, 0, 1);
  return getNextWordRevealIndex(trimmedText, firstWordEnd, 1) > firstWordEnd;
};

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function useSmoothStreamingText(text: string, shouldAnimate: boolean): string {
  const shouldContinueAnimatingRef = useRef(shouldAnimate);
  const reducedMotionRef = useRef(prefersReducedMotion());
  const initialText = (() => {
    if (!shouldAnimate || reducedMotionRef.current) {
      return text;
    }

    const initialIndex = getNextWordRevealIndex(text, 0, INITIAL_WORD_COUNT);
    return text.slice(0, initialIndex);
  })();
  const targetTextRef = useRef(text);
  const displayedTextRef = useRef(initialText);
  const timeoutIdRef = useRef<number>();
  const [displayedText, setDisplayedText] = useState(initialText);

  const scheduleNextReveal = useCallback(() => {
    if (timeoutIdRef.current != null) {
      return;
    }

    const revealNext = () => {
      timeoutIdRef.current = undefined;

      const targetText = targetTextRef.current;
      const currentText = displayedTextRef.current;
      if (!targetText.startsWith(currentText) || currentText.length >= targetText.length) {
        return;
      }

      const remainingCharacters = targetText.length - currentText.length;
      const nextIndex = getNextWordRevealIndex(
        targetText,
        currentText.length,
        getWordsPerInterval(remainingCharacters),
      );
      const nextText = targetText.slice(0, nextIndex);
      displayedTextRef.current = nextText;
      setDisplayedText(nextText);

      if (nextText.length < targetTextRef.current.length) {
        timeoutIdRef.current = window.setTimeout(revealNext, REVEAL_INTERVAL_MS);
      }
    };

    timeoutIdRef.current = window.setTimeout(revealNext, REVEAL_INTERVAL_MS);
  }, []);

  useEffect(() => {
    targetTextRef.current = text;

    if (shouldAnimate) {
      shouldContinueAnimatingRef.current = true;
    }

    if (!shouldContinueAnimatingRef.current || reducedMotionRef.current) {
      displayedTextRef.current = text;
      setDisplayedText(text);
      return;
    }

    if (!text.startsWith(displayedTextRef.current)) {
      displayedTextRef.current = text;
      setDisplayedText(text);
      return;
    }

    scheduleNextReveal();
  }, [scheduleNextReveal, shouldAnimate, text]);

  useEffect(
    () => () => {
      if (timeoutIdRef.current != null) {
        window.clearTimeout(timeoutIdRef.current);
      }
    },
    [],
  );

  return displayedText;
}
