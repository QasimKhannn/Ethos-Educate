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
import { useMediaQuery } from '@librechat/client';

import type { NavLink } from '~/common';
import type { TranslationKeys } from '~/hooks';

import { useLocalize } from '~/hooks';

type TourPlacement = 'left' | 'bottom';

type TourCopy = {
  titleKey: TranslationKeys;
  bodyKey: TranslationKeys;
};

type TourStep = TourCopy & {
  id: string;
  selector: string;
  placement: TourPlacement;
};

type RectMeasurement = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

type ControlPanelTourProps = {
  active: boolean;
  links: NavLink[];
  onFinish: () => void;
};

const CARD_WIDTH = 332;
const CARD_MIN_HEIGHT = 196;
const CARD_GAP = 12;
const SPOTLIGHT_PADDING = 5;
const SPOTLIGHT_RADIUS = 15;
const TOUR_ROOT_SELECTOR = '[data-control-panel-tour-root="true"]';

const getTourSelector = (id: string) =>
  `${TOUR_ROOT_SELECTOR} [data-control-panel-tour-id="${id}"]`;

const LINK_TOUR_COPY: Record<string, TourCopy> = {
  agents: {
    titleKey: 'com_ui_control_panel_tour_agent_builder_title',
    bodyKey: 'com_ui_control_panel_tour_agent_builder_body',
  },
  assistants: {
    titleKey: 'com_ui_control_panel_tour_assistant_builder_title',
    bodyKey: 'com_ui_control_panel_tour_assistant_builder_body',
  },
  azureAssistants: {
    titleKey: 'com_ui_control_panel_tour_assistant_builder_title',
    bodyKey: 'com_ui_control_panel_tour_assistant_builder_body',
  },
  prompts: {
    titleKey: 'com_ui_control_panel_tour_prompts_title',
    bodyKey: 'com_ui_control_panel_tour_prompts_body',
  },
  memories: {
    titleKey: 'com_ui_control_panel_tour_memories_title',
    bodyKey: 'com_ui_control_panel_tour_memories_body',
  },
  parameters: {
    titleKey: 'com_ui_control_panel_tour_parameters_title',
    bodyKey: 'com_ui_control_panel_tour_parameters_body',
  },
  files: {
    titleKey: 'com_ui_control_panel_tour_files_title',
    bodyKey: 'com_ui_control_panel_tour_files_body',
  },
  bookmarks: {
    titleKey: 'com_ui_control_panel_tour_bookmarks_title',
    bodyKey: 'com_ui_control_panel_tour_bookmarks_body',
  },
  'mcp-builder': {
    titleKey: 'com_ui_control_panel_tour_mcp_title',
    bodyKey: 'com_ui_control_panel_tour_mcp_body',
  },
};

const HEADER_TOUR_STEPS: TourStep[] = [
  {
    id: 'admin-settings',
    selector: `${getTourSelector('admin-settings')}, ${TOUR_ROOT_SELECTOR} button[aria-label="Admin Settings"]`,
    placement: 'left',
    titleKey: 'com_ui_control_panel_tour_admin_title',
    bodyKey: 'com_ui_control_panel_tour_admin_body',
  },
];

const CLOSE_TOUR_STEP: TourStep = {
  id: 'close',
  selector: `${getTourSelector('close')}, ${TOUR_ROOT_SELECTOR} button[aria-label="Close Control Panel"]`,
  placement: 'left',
  titleKey: 'com_ui_control_panel_tour_close_title',
  bodyKey: 'com_ui_control_panel_tour_close_body',
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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

const getStepRect = (element: HTMLElement): RectMeasurement => {
  const rect = element.getBoundingClientRect();
  const top = clamp(rect.top - SPOTLIGHT_PADDING, 8, window.innerHeight);
  const left = clamp(rect.left - SPOTLIGHT_PADDING, 8, window.innerWidth);
  const width = clamp(rect.width + SPOTLIGHT_PADDING * 2, 0, window.innerWidth - left - 8);
  const height = clamp(rect.height + SPOTLIGHT_PADDING * 2, 0, window.innerHeight - top - 8);

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
  cardHeight: number,
) => {
  if (isCompact) {
    return {
      top: window.innerHeight - cardHeight - 18,
      left: 16,
      width: Math.max(0, window.innerWidth - 32),
    };
  }

  const maxTop = Math.max(16, window.innerHeight - cardHeight - 16);
  const centeredTop = clamp(rect.top + rect.height / 2 - cardHeight / 2, 16, maxTop);
  const leftPosition = rect.left - CARD_GAP - CARD_WIDTH;

  if (placement === 'left' && leftPosition >= 16) {
    return {
      top: centeredTop,
      left: leftPosition,
      width: CARD_WIDTH,
    };
  }

  return {
    top: clamp(rect.bottom + CARD_GAP, 16, maxTop),
    left: clamp(rect.left, 16, Math.max(16, window.innerWidth - CARD_WIDTH - 16)),
    width: CARD_WIDTH,
  };
};

const isTourOwnedMutation = (mutation: MutationRecord) => {
  const target = mutation.target;

  return target instanceof Element && target.closest('.control-panel-tour') != null;
};

const buildTourSteps = (links: NavLink[]) => [
  ...HEADER_TOUR_STEPS,
  ...links.flatMap((link) => {
    const copy = LINK_TOUR_COPY[link.id];

    if (copy == null) {
      return [];
    }

    return [
      {
        id: link.id,
        selector: getTourSelector(link.id),
        placement: 'left' as const,
        ...copy,
      },
    ];
  }),
  CLOSE_TOUR_STEP,
];

export default function ControlPanelTour({ active, links, onFinish }: ControlPanelTourProps) {
  const localize = useLocalize();
  const isCompact = useMediaQuery('(max-width: 760px)');
  const spotlightMaskId = useId().replace(/:/g, '');
  const cardRef = useRef<HTMLDivElement>(null);
  const layoutFrameRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [cardHeight, setCardHeight] = useState(CARD_MIN_HEIGHT);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const steps = useMemo(() => buildTourSteps(links), [links]);
  const currentStep = steps[currentIndex];

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

  const finishTour = useCallback(() => {
    setIsOpen(false);
    setCurrentIndex(0);
    onFinish();
  }, [onFinish]);

  const moveToStep = useCallback(
    (targetIndex: number) => {
      if (targetIndex >= steps.length) {
        finishTour();
        return;
      }

      setCurrentIndex(clamp(targetIndex, 0, Math.max(steps.length - 1, 0)));
      requestLayoutUpdate();
    },
    [finishTour, requestLayoutUpdate, steps.length],
  );

  useEffect(() => {
    if (!active || steps.length === 0) {
      setIsOpen(false);
      return;
    }

    setCurrentIndex(0);

    let attempts = 0;
    let timeoutId: number | null = null;

    const tryOpen = () => {
      const firstStep = steps[0];

      if (firstStep != null && readStepTarget(firstStep.selector) != null) {
        requestLayoutUpdate();
        setIsOpen(true);
        return;
      }

      if (attempts >= 12) {
        onFinish();
        return;
      }

      attempts += 1;
      timeoutId = window.setTimeout(tryOpen, 120);
    };

    timeoutId = window.setTimeout(tryOpen, 260);

    return () => {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [active, onFinish, requestLayoutUpdate, steps]);

  useEffect(() => {
    if (!active || currentIndex < steps.length) {
      return;
    }

    finishTour();
  }, [active, currentIndex, finishTour, steps.length]);

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
      attributeFilter: ['class', 'style', 'data-control-panel-tour-id'],
    });

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, requestLayoutUpdate]);

  const currentElement = useMemo(
    () => (currentStep != null ? readStepTarget(currentStep.selector) : null),
    [currentStep, isOpen, layoutVersion],
  );

  useEffect(() => {
    if (!isOpen || currentStep == null || currentElement != null) {
      return;
    }

    moveToStep(currentIndex + 1);
  }, [currentElement, currentIndex, currentStep, isOpen, moveToStep]);

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
        finishTour();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveToStep(currentIndex + 1);
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveToStep(currentIndex - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, finishTour, isOpen, moveToStep]);

  const currentRect = useMemo(
    () => (currentElement != null ? getStepRect(currentElement) : null),
    [currentElement, layoutVersion],
  );

  const tooltipStyle = useMemo(() => {
    if (currentRect == null || currentStep == null) {
      return undefined;
    }

    const position = getTooltipPosition(
      currentRect,
      currentStep.placement,
      isCompact,
      cardHeight,
    );
    const maxTop = Math.max(16, window.innerHeight - cardHeight - 16);

    return {
      top: clamp(position.top, 16, maxTop),
      left: position.left,
      width: position.width,
    };
  }, [cardHeight, currentRect, currentStep, isCompact]);

  const stepCounter = useMemo(
    () =>
      localize('com_ui_onboarding_step', {
        current: currentIndex + 1,
        total: steps.length,
      }),
    [currentIndex, localize, steps.length],
  );

  const progressWidth = useMemo(
    () => `${((currentIndex + 1) / Math.max(steps.length, 1)) * 100}%`,
    [currentIndex, steps.length],
  );

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
        className="control-panel-tour"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
      >
        <svg
          className="control-panel-tour-overlay"
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
                rx={SPOTLIGHT_RADIUS}
                ry={SPOTLIGHT_RADIUS}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            className="control-panel-tour-overlay-fill"
            width={window.innerWidth}
            height={window.innerHeight}
            mask={`url(#${spotlightMaskId})`}
          />
        </svg>
        <motion.div
          className="control-panel-tour-spotlight"
          initial={false}
          animate={{
            top: currentRect.top,
            left: currentRect.left,
            width: currentRect.width,
            height: currentRect.height,
          }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        />
        <motion.div
          ref={cardRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={localize(currentStep.titleKey)}
          className="control-panel-tour-card"
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: 1,
            y: 0,
            top: tooltipStyle.top,
            left: tooltipStyle.left,
            width: tooltipStyle.width,
          }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <div className="control-panel-tour-progress" aria-hidden="true">
            <span style={{ width: progressWidth }} />
          </div>
          <div className="control-panel-tour-card-header">
            <div>
              <p className="control-panel-tour-step-label">
                {localize('com_ui_control_panel_tour_label')}
              </p>
              <p className="control-panel-tour-step-count">{stepCounter}</p>
            </div>
            <button type="button" className="control-panel-tour-skip" onClick={finishTour}>
              {localize('com_ui_skip')}
            </button>
          </div>
          <div className="control-panel-tour-card-body">
            <h2 className="control-panel-tour-title">{localize(currentStep.titleKey)}</h2>
            <p className="control-panel-tour-description">{localize(currentStep.bodyKey)}</p>
          </div>
          <div className="control-panel-tour-card-footer">
            <button
              type="button"
              className="control-panel-tour-secondary"
              onClick={() => moveToStep(currentIndex - 1)}
              disabled={currentIndex === 0}
            >
              {localize('com_ui_back')}
            </button>
            <button
              type="button"
              className="control-panel-tour-primary"
              onClick={() => moveToStep(currentIndex + 1)}
            >
              {currentIndex === steps.length - 1 ? localize('com_ui_done') : localize('com_ui_next')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
