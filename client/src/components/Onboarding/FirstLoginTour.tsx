import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@librechat/client';
import { useLocalize } from '~/hooks';

type TourPlacement = 'top' | 'right' | 'bottom' | 'left';
type TourScreen = 'chat' | 'marketplace';

type TourStepConfig = {
  id: string;
  selector: string;
  fallbackSelector?: string;
  titleKey: string;
  bodyKey: string;
  placement: TourPlacement;
  screen: TourScreen;
  openEvent?: string;
  closeEvent?: string;
  autoAdvanceDelay?: number;
};

type RectMeasurement = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

const CARD_WIDTH = 360;
const CARD_HEIGHT = 212;
const OVERLAY_GAP = 14;
const SPOTLIGHT_PADDING = 10;
const MIN_SPOTLIGHT_PADDING = -8;
const SPOTLIGHT_RADIUS = 18;
const MIN_SPOTLIGHT_RADIUS = 8;
const CLIP_INSET = 4;
const DEFAULT_AUTO_ADVANCE_DELAY = 5600;
const PREVIEW_AUTO_ADVANCE_DELAY = 6800;
const SCREEN_SWITCH_DELAY = 180;
const OPEN_RETRY_DELAY = 180;
const OPEN_RETRY_LIMIT = 56;

const TOUR_STEPS: TourStepConfig[] = [
  {
    id: 'nav-search',
    selector: '[data-tour-id="nav-search-dialog"]',
    fallbackSelector: '[data-tour-id="nav-search"]',
    titleKey: 'com_ui_onboarding_search_title',
    bodyKey: 'com_ui_onboarding_search_body',
    placement: 'bottom',
    screen: 'chat',
    openEvent: 'nav-search-tour-open',
    closeEvent: 'nav-search-tour-close',
    autoAdvanceDelay: PREVIEW_AUTO_ADVANCE_DELAY,
  },
  {
    id: 'nav-bookmarks',
    selector: '[data-tour-id="nav-bookmarks"]',
    titleKey: 'com_ui_onboarding_bookmarks_title',
    bodyKey: 'com_ui_onboarding_bookmarks_body',
    placement: 'bottom',
    screen: 'chat',
    openEvent: 'nav-bookmarks-tour-open',
    closeEvent: 'nav-bookmarks-tour-close',
  },
  {
    id: 'nav-new-chat',
    selector: '[data-tour-id="nav-new-chat"]',
    titleKey: 'com_ui_onboarding_new_chat_title',
    bodyKey: 'com_ui_onboarding_new_chat_body',
    placement: 'bottom',
    screen: 'chat',
  },
  {
    id: 'nav-marketplace',
    selector: '[data-tour-id="nav-marketplace"]',
    titleKey: 'com_ui_onboarding_marketplace_title',
    bodyKey: 'com_ui_onboarding_marketplace_body',
    placement: 'right',
    screen: 'chat',
  },
  {
    id: 'marketplace-search',
    selector: '[data-tour-id="marketplace-search"]',
    titleKey: 'com_ui_onboarding_marketplace_search_title',
    bodyKey: 'com_ui_onboarding_marketplace_search_body',
    placement: 'bottom',
    screen: 'marketplace',
  },
  {
    id: 'marketplace-categories',
    selector: '[data-tour-id="marketplace-categories"]',
    titleKey: 'com_ui_onboarding_marketplace_categories_title',
    bodyKey: 'com_ui_onboarding_marketplace_categories_body',
    placement: 'bottom',
    screen: 'marketplace',
  },
  {
    id: 'marketplace-results',
    selector: '[data-tour-id="marketplace-agent-detail"]',
    fallbackSelector: '[data-tour-id="marketplace-agent"], [data-tour-id="marketplace-results"]',
    titleKey: 'com_ui_onboarding_marketplace_results_title',
    bodyKey: 'com_ui_onboarding_marketplace_results_body',
    placement: 'top',
    screen: 'marketplace',
    openEvent: 'marketplace-agent-tour-open',
    closeEvent: 'marketplace-agent-tour-close',
    autoAdvanceDelay: PREVIEW_AUTO_ADVANCE_DELAY,
  },
  {
    id: 'sidepanel-controls',
    selector: '[data-tour-id="sidepanel-controls"]',
    titleKey: 'com_ui_onboarding_controls_title',
    bodyKey: 'com_ui_onboarding_controls_body',
    placement: 'left',
    screen: 'marketplace',
  },
  {
    id: 'sidepanel-sections',
    selector: '[data-tour-id="sidepanel-sections"]',
    titleKey: 'com_ui_onboarding_sidepanel_sections_title',
    bodyKey: 'com_ui_onboarding_sidepanel_sections_body',
    placement: 'left',
    screen: 'marketplace',
  },
  {
    id: 'chat-composer',
    selector: '[data-tour-id="chat-composer"]',
    titleKey: 'com_ui_onboarding_composer_title',
    bodyKey: 'com_ui_onboarding_composer_body',
    placement: 'top',
    screen: 'chat',
  },
  {
    id: 'nav-account',
    selector: '[data-tour-id="nav-account-menu"]',
    fallbackSelector: '[data-tour-id="nav-account"]',
    titleKey: 'com_ui_onboarding_profile_title',
    bodyKey: 'com_ui_onboarding_profile_body',
    placement: 'top',
    screen: 'chat',
    openEvent: 'nav-account-tour-open',
    closeEvent: 'nav-account-tour-close',
    autoAdvanceDelay: PREVIEW_AUTO_ADVANCE_DELAY,
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const isSidepanelExpandedStep = (step: TourStepConfig | null | undefined) =>
  step?.id === 'sidepanel-sections';
const isNavExpandedStep = (step: TourStepConfig | null | undefined) =>
  step?.id.startsWith('nav-') ?? false;

const readStepTarget = (selector: string) => {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
  const element = elements.find((candidate) => {
    const rect = candidate.getBoundingClientRect();

    return rect.width > 0 && rect.height > 0;
  });

  if (element == null) {
    return null;
  }

  return element;
};

const readTourStepTarget = (step: TourStepConfig) =>
  readStepTarget(step.selector) ??
  (step.fallbackSelector != null ? readStepTarget(step.fallbackSelector) : null);

const dispatchTourEvent = (eventName: string | undefined) => {
  if (eventName == null) {
    return;
  }

  window.dispatchEvent(new CustomEvent(eventName));
};

const closeTourPreview = (step: TourStepConfig | null | undefined) => {
  dispatchTourEvent(step?.closeEvent);
};

const closeAllTourPreviews = () => {
  TOUR_STEPS.forEach((step) => closeTourPreview(step));
  window.dispatchEvent(new CustomEvent('nav-tour-close'));
  window.dispatchEvent(new CustomEvent('sidepanel-tour-close'));
};

const getMeasuredRect = (element: HTMLElement) => {
  const selector = element.dataset.tourTargetSelector;

  if (selector == null || selector.length === 0) {
    return element.getBoundingClientRect();
  }

  const targets = Array.from(element.querySelectorAll<HTMLElement>(selector)).filter(
    (target) => target.offsetWidth > 0 && target.offsetHeight > 0,
  );

  if (targets.length === 0) {
    return element.getBoundingClientRect();
  }

  const firstRect = targets[0].getBoundingClientRect();

  return targets.slice(1).reduce((accumulator, target) => {
    const rect = target.getBoundingClientRect();

    return {
      top: Math.min(accumulator.top, rect.top),
      left: Math.min(accumulator.left, rect.left),
      right: Math.max(accumulator.right, rect.right),
      bottom: Math.max(accumulator.bottom, rect.bottom),
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: firstRect.toJSON.bind(firstRect),
    } as DOMRect;
  }, firstRect);
};

const getSpotlightPadding = (element: HTMLElement) => {
  const customPadding = Number.parseFloat(element.dataset.tourPadding ?? '');

  if (Number.isNaN(customPadding)) {
    return SPOTLIGHT_PADDING;
  }

  return Math.max(MIN_SPOTLIGHT_PADDING, customPadding);
};

const getSpotlightOffset = (element: HTMLElement, axis: 'x' | 'y') => {
  const datasetKey = axis === 'x' ? element.dataset.tourOffsetX : element.dataset.tourOffsetY;
  const customOffset = Number.parseFloat(datasetKey ?? '');

  if (Number.isNaN(customOffset)) {
    return 0;
  }

  return customOffset;
};

const getSpotlightRadius = (element: HTMLElement) => {
  const customRadius = Number.parseFloat(element.dataset.tourRadius ?? '');

  if (Number.isNaN(customRadius)) {
    return SPOTLIGHT_RADIUS;
  }

  return Math.max(MIN_SPOTLIGHT_RADIUS, customRadius);
};

const getSpotlightClipRect = (element: HTMLElement) => {
  const clipRootKey = element.dataset.tourClip;

  if (!clipRootKey) {
    return null;
  }

  const clipRoot = document.querySelector<HTMLElement>(`[data-tour-clip-root="${clipRootKey}"]`);

  if (clipRoot == null || clipRoot.offsetWidth === 0 || clipRoot.offsetHeight === 0) {
    return null;
  }

  return clipRoot.getBoundingClientRect();
};

const getStepRect = (element: HTMLElement): RectMeasurement => {
  const rect = getMeasuredRect(element);
  const spotlightPadding = getSpotlightPadding(element);
  const spotlightOffsetX = getSpotlightOffset(element, 'x');
  const spotlightOffsetY = getSpotlightOffset(element, 'y');
  const clipRect = getSpotlightClipRect(element);
  const unclampedTop = rect.top - spotlightPadding + spotlightOffsetY;
  const unclampedLeft = rect.left - spotlightPadding + spotlightOffsetX;
  const unclampedRight = rect.right + spotlightPadding + spotlightOffsetX;
  const unclampedBottom = rect.bottom + spotlightPadding + spotlightOffsetY;
  const clippedTop =
    clipRect != null ? Math.max(unclampedTop, clipRect.top + CLIP_INSET) : unclampedTop;
  const clippedLeft =
    clipRect != null ? Math.max(unclampedLeft, clipRect.left + CLIP_INSET) : unclampedLeft;
  const clippedRight =
    clipRect != null ? Math.min(unclampedRight, clipRect.right - CLIP_INSET) : unclampedRight;
  const clippedBottom =
    clipRect != null ? Math.min(unclampedBottom, clipRect.bottom - CLIP_INSET) : unclampedBottom;
  const top = clamp(clippedTop, 8, window.innerHeight);
  const left = clamp(clippedLeft, 8, window.innerWidth);
  const width = clamp(clippedRight - clippedLeft, 0, window.innerWidth - left - 8);
  const height = clamp(clippedBottom - clippedTop, 0, window.innerHeight - top - 8);

  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
};

const getTooltipPosition = (
  rect: RectMeasurement,
  placement: TourPlacement,
  isCompact: boolean,
) => {
  if (isCompact) {
    return {
      top: window.innerHeight - CARD_HEIGHT - 24,
      left: 16,
      width: Math.max(0, window.innerWidth - 32),
    };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxLeft = Math.max(16, viewportWidth - CARD_WIDTH - 16);
  const maxTop = Math.max(16, viewportHeight - CARD_HEIGHT - 16);
  const centeredLeft = clamp(rect.left + rect.width / 2 - CARD_WIDTH / 2, 16, maxLeft);
  const centeredTop = clamp(rect.top + rect.height / 2 - CARD_HEIGHT / 2, 16, maxTop);

  const placements: TourPlacement[] = [placement, 'right', 'left', 'bottom', 'top'].filter(
    (value, index, values) => values.indexOf(value) === index,
  );

  for (const nextPlacement of placements) {
    if (nextPlacement === 'right' && rect.right + OVERLAY_GAP + CARD_WIDTH <= viewportWidth - 16) {
      return {
        top: centeredTop,
        left: rect.right + OVERLAY_GAP,
        width: CARD_WIDTH,
      };
    }

    if (nextPlacement === 'left' && rect.left - OVERLAY_GAP - CARD_WIDTH >= 16) {
      return {
        top: centeredTop,
        left: rect.left - OVERLAY_GAP - CARD_WIDTH,
        width: CARD_WIDTH,
      };
    }

    if (
      nextPlacement === 'bottom' &&
      rect.bottom + OVERLAY_GAP + CARD_HEIGHT <= viewportHeight - 16
    ) {
      return {
        top: rect.bottom + OVERLAY_GAP,
        left: centeredLeft,
        width: CARD_WIDTH,
      };
    }

    if (nextPlacement === 'top' && rect.top - OVERLAY_GAP - CARD_HEIGHT >= 16) {
      return {
        top: rect.top - OVERLAY_GAP - CARD_HEIGHT,
        left: centeredLeft,
        width: CARD_WIDTH,
      };
    }
  }

  return {
    top: clamp(rect.bottom + OVERLAY_GAP, 16, maxTop),
    left: centeredLeft,
    width: CARD_WIDTH,
  };
};

const matchesTourScreen = (pathname: string, screen: TourScreen) =>
  screen === 'marketplace' ? pathname.startsWith('/agents') : pathname.startsWith('/c/');

const getPathForTourScreen = (screen: TourScreen) =>
  screen === 'marketplace' ? '/agents' : '/c/new';

const isTourOwnedMutation = (mutation: MutationRecord) => {
  const target = mutation.target;

  return target instanceof Element && target.closest('.first-login-tour') != null;
};

const isRectInViewport = (rect: DOMRect) =>
  rect.top >= 16 &&
  rect.left >= 16 &&
  rect.bottom <= window.innerHeight - 16 &&
  rect.right <= window.innerWidth - 16;

type FirstLoginTourProps = {
  disabled?: boolean;
  storageKey: string;
};

const readStoredProgress = (storageKey: string) => {
  const rawValue = localStorage.getItem(storageKey);
  const parsedValue = rawValue != null ? Number.parseInt(rawValue, 10) : 0;

  if (Number.isNaN(parsedValue)) {
    return 0;
  }

  return clamp(parsedValue, 0, TOUR_STEPS.length);
};

export default function FirstLoginTour({ disabled = false, storageKey }: FirstLoginTourProps) {
  const localize = useLocalize();
  const location = useLocation();
  const navigate = useNavigate();
  const isCompact = useMediaQuery('(max-width: 960px)');
  const spotlightMaskId = useId().replace(/:/g, '');
  const cardRef = useRef<HTMLDivElement>(null);
  const layoutFrameRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(() =>
    readStoredProgress(`${storageKey}:progress`),
  );
  const [cardHeight, setCardHeight] = useState(CARD_HEIGHT);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const progressStorageKey = useMemo(() => `${storageKey}:progress`, [storageKey]);
  const completionStorageKey = useMemo(() => `${storageKey}:complete`, [storageKey]);
  const currentStep = TOUR_STEPS[currentIndex];

  const requestLayoutUpdate = useCallback(() => {
    if (layoutFrameRef.current != null) {
      return;
    }

    layoutFrameRef.current = window.requestAnimationFrame(() => {
      layoutFrameRef.current = null;
      setLayoutVersion((previous) => previous + 1);
    });
  }, []);

  useEffect(
    () => () => {
      if (layoutFrameRef.current != null) {
        window.cancelAnimationFrame(layoutFrameRef.current);
      }
    },
    [],
  );

  const persistProgress = useCallback(
    (nextIndex: number) => {
      const safeIndex = clamp(nextIndex, 0, TOUR_STEPS.length);
      localStorage.setItem(progressStorageKey, String(safeIndex));
      window.dispatchEvent(new StorageEvent('storage', { key: progressStorageKey }));
      setCurrentIndex(safeIndex);
    },
    [progressStorageKey],
  );

  const markComplete = useCallback(() => {
    closeAllTourPreviews();
    localStorage.setItem(completionStorageKey, JSON.stringify(true));
    localStorage.setItem('newUser', JSON.stringify(false));
    window.dispatchEvent(new StorageEvent('storage', { key: completionStorageKey }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'newUser' }));
    setIsOpen(false);
  }, [completionStorageKey]);

  const moveToStep = useCallback(
    (targetIndex: number) => {
      const safeIndex = clamp(targetIndex, 0, TOUR_STEPS.length);

      if (safeIndex >= TOUR_STEPS.length) {
        markComplete();
        return;
      }

      const nextStep = TOUR_STEPS[safeIndex];
      closeTourPreview(currentStep);

      const shouldClosePanelFirst =
        isSidepanelExpandedStep(currentStep) && !isSidepanelExpandedStep(nextStep);
      const shouldCloseNavFirst = isNavExpandedStep(currentStep) && !isNavExpandedStep(nextStep);
      const shouldNavigate = !matchesTourScreen(location.pathname, nextStep.screen);

      if (shouldClosePanelFirst) {
        window.dispatchEvent(new CustomEvent('sidepanel-tour-close'));
        setIsOpen(false);

        window.setTimeout(() => {
          persistProgress(safeIndex);

          if (shouldNavigate) {
            window.setTimeout(() => {
              navigate(getPathForTourScreen(nextStep.screen), { replace: true });
            }, SCREEN_SWITCH_DELAY);
            return;
          }

          requestLayoutUpdate();
          setIsOpen(true);
        }, 220);

        return;
      }

      if (shouldCloseNavFirst) {
        window.dispatchEvent(new CustomEvent('nav-tour-close'));
        setIsOpen(false);

        window.setTimeout(() => {
          persistProgress(safeIndex);

          if (shouldNavigate) {
            window.setTimeout(() => {
              navigate(getPathForTourScreen(nextStep.screen), { replace: true });
            }, SCREEN_SWITCH_DELAY);
            return;
          }

          requestLayoutUpdate();
          setIsOpen(true);
        }, 220);

        return;
      }

      persistProgress(safeIndex);

      if (shouldNavigate) {
        setIsOpen(false);
        window.setTimeout(() => {
          navigate(getPathForTourScreen(nextStep.screen), { replace: true });
        }, SCREEN_SWITCH_DELAY);
      }
    },
    [currentStep, location.pathname, markComplete, navigate, persistProgress, requestLayoutUpdate],
  );

  useEffect(() => {
    if (disabled) {
      closeAllTourPreviews();
      setIsOpen(false);
      return;
    }

    if (localStorage.getItem(completionStorageKey) === JSON.stringify(true)) {
      closeAllTourPreviews();
      setIsOpen(false);
      return;
    }

    if (currentIndex >= TOUR_STEPS.length) {
      markComplete();
      return;
    }

    const currentStep = TOUR_STEPS[currentIndex];

    let attempts = 0;
    let timeoutId: number | null = null;

    const tryOpen = () => {
      if (!matchesTourScreen(location.pathname, currentStep.screen)) {
        setIsOpen(false);
        return;
      }

      if (isNavExpandedStep(currentStep)) {
        window.dispatchEvent(new CustomEvent('nav-tour-open'));
      } else {
        window.dispatchEvent(new CustomEvent('nav-tour-close'));
      }

      if (isSidepanelExpandedStep(currentStep)) {
        window.dispatchEvent(new CustomEvent('sidepanel-tour-open'));
      } else {
        window.dispatchEvent(new CustomEvent('sidepanel-tour-close'));
      }

      dispatchTourEvent(currentStep.openEvent);

      const element = readTourStepTarget(currentStep);

      if (element != null) {
        requestLayoutUpdate();
        setIsOpen(true);
        return;
      }

      if (attempts >= OPEN_RETRY_LIMIT) {
        moveToStep(currentIndex + 1);
        return;
      }

      attempts += 1;
      timeoutId = window.setTimeout(tryOpen, OPEN_RETRY_DELAY);
    };

    timeoutId = window.setTimeout(tryOpen, 280);

    return () => {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
      closeTourPreview(currentStep);
    };
  }, [
    completionStorageKey,
    currentIndex,
    disabled,
    location.pathname,
    markComplete,
    moveToStep,
    navigate,
    requestLayoutUpdate,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleResize = () => requestLayoutUpdate();
    const handleScroll = () => requestLayoutUpdate();
    const observer = new MutationObserver((mutations) => {
      if (mutations.every(isTourOwnedMutation)) {
        return;
      }

      requestLayoutUpdate();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'class',
        'style',
        'data-tour-id',
        'data-tour-padding',
        'data-tour-radius',
        'data-tour-offset-x',
        'data-tour-offset-y',
      ],
    });

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, requestLayoutUpdate]);

  useEffect(() => {
    if (!isOpen || currentStep == null || currentStep.openEvent == null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      dispatchTourEvent(currentStep.openEvent);
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [currentIndex, currentStep, isOpen]);

  const currentElement = useMemo(
    () => (currentStep != null ? readTourStepTarget(currentStep) : null),
    [currentStep, layoutVersion],
  );

  useEffect(() => {
    if (!isOpen || currentStep == null || currentElement == null) {
      return;
    }

    if (isRectInViewport(currentElement.getBoundingClientRect())) {
      return;
    }

    currentElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    });
  }, [currentElement, currentStep, isOpen]);

  useLayoutEffect(() => {
    if (cardRef.current == null) {
      return;
    }

    setCardHeight(cardRef.current.getBoundingClientRect().height);
  }, [currentIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    cardRef.current?.focus();
  }, [currentIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        markComplete();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveToStep(currentIndex + 1);
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveToStep(clamp(currentIndex - 1, 0, TOUR_STEPS.length - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isOpen, markComplete, moveToStep]);

  const autoAdvanceDelay = currentStep?.autoAdvanceDelay ?? DEFAULT_AUTO_ADVANCE_DELAY;

  useEffect(() => {
    if (!isOpen || currentStep == null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      moveToStep(currentIndex + 1);
    }, autoAdvanceDelay);

    return () => window.clearTimeout(timeoutId);
  }, [autoAdvanceDelay, currentIndex, currentStep, isOpen, moveToStep]);

  const currentRect = useMemo(
    () => (currentElement != null ? getStepRect(currentElement) : null),
    [currentElement, layoutVersion],
  );
  const currentRadius = useMemo(
    () => (currentElement != null ? getSpotlightRadius(currentElement) : SPOTLIGHT_RADIUS),
    [currentElement, layoutVersion],
  );

  const tooltipStyle = useMemo(() => {
    if (currentRect == null) {
      return undefined;
    }

    const viewportHeight = window.innerHeight;
    const maxTop = Math.max(16, viewportHeight - cardHeight - 16);
    const nextPosition = getTooltipPosition(currentRect, currentStep.placement, isCompact);

    return {
      top: clamp(nextPosition.top, 16, maxTop),
      left: nextPosition.left,
      width: nextPosition.width,
    };
  }, [cardHeight, currentRect, currentStep, isCompact]);

  const stepCounter = useMemo(
    () =>
      localize('com_ui_onboarding_step', {
        current: currentIndex + 1,
        total: TOUR_STEPS.length,
      }),
    [currentIndex, localize],
  );

  const handleNext = useCallback(() => {
    moveToStep(currentIndex + 1);
  }, [currentIndex, moveToStep]);

  if (
    !isOpen ||
    currentStep == null ||
    currentElement == null ||
    currentRect == null ||
    tooltipStyle == null
  ) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="first-login-tour"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <svg
          className="first-login-tour-overlay"
          viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <mask id={spotlightMaskId}>
              <rect width={window.innerWidth} height={window.innerHeight} fill="white" />
              <rect
                x={currentRect.left}
                y={currentRect.top}
                width={currentRect.width}
                height={currentRect.height}
                rx={currentRadius}
                ry={currentRadius}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            className="first-login-tour-overlay-fill"
            width={window.innerWidth}
            height={window.innerHeight}
            mask={`url(#${spotlightMaskId})`}
          />
        </svg>
        <motion.div
          className="first-login-tour-spotlight"
          initial={false}
          animate={{
            top: currentRect.top,
            left: currentRect.left,
            width: currentRect.width,
            height: currentRect.height,
            borderRadius: currentRadius,
          }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        />
        <motion.div
          ref={cardRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={localize(currentStep.titleKey)}
          className="first-login-tour-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{
            opacity: 1,
            y: 0,
            top: tooltipStyle.top,
            left: tooltipStyle.left,
            width: tooltipStyle.width,
          }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <div className="first-login-tour-progress" aria-hidden="true">
            <span
              key={currentStep.id}
              style={{
                animationDuration: `${autoAdvanceDelay}ms`,
              }}
            />
          </div>
          <div className="first-login-tour-card-header">
            <div>
              <p className="first-login-tour-step-label">{localize('com_ui_onboarding_label')}</p>
              <p className="first-login-tour-step-count">{stepCounter}</p>
            </div>
            <button type="button" className="first-login-tour-skip" onClick={markComplete}>
              {localize('com_ui_skip')}
            </button>
          </div>
          <div className="first-login-tour-card-body">
            <h2 className="first-login-tour-title">{localize(currentStep.titleKey)}</h2>
            <p className="first-login-tour-description">{localize(currentStep.bodyKey)}</p>
          </div>
          <div className="first-login-tour-card-footer">
            <button
              type="button"
              className="first-login-tour-secondary"
              onClick={() => {
                moveToStep(clamp(currentIndex - 1, 0, TOUR_STEPS.length - 1));
              }}
              disabled={currentIndex === 0}
            >
              {localize('com_ui_back')}
            </button>
            <button type="button" className="first-login-tour-primary" onClick={handleNext}>
              {currentIndex === TOUR_STEPS.length - 1
                ? localize('com_ui_done')
                : localize('com_ui_next')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
