// cowork — self-contained onboarding tour for the Cowork section ONLY.
//
// This does NOT import, reuse, or modify FirstLoginTour, so it can never affect the
// site-wide signup tour. It only reuses the existing `.first-login-tour*` CSS classes
// (defined in style.css) for a consistent look. No new styles, no shared logic.
//
// Two phases, gated independently in localStorage (per user):
//   Phase 1 — on /cowork (no project open): intro + New project + Connectors.
//   Phase 2 — on /cowork/:projectId: chats, model lock, panel tabs, mode toggle + outro.
// Skip (on any card, including the intro) dismisses BOTH phases for good in this browser.
// A "Take a tour" button in the sidebar dispatches `cowork-tour-replay` to restart it.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '~/hooks/AuthContext';

type Placement = 'top' | 'bottom' | 'left' | 'right';

type TourStep = {
  id: string;
  /** data-tour-id selector to spotlight. Omit for a centered card (intro / outro). */
  selector?: string;
  title: string;
  body: string;
  placement?: Placement;
  /** Open the right-side panel drawer (mobile) before showing this step. */
  openPanel?: boolean;
  /** Open a fresh chat before showing this step (so the composer / mode toggle is visible). */
  openNewChat?: boolean;
};

const INTRO: TourStep = {
  id: 'intro',
  title: 'Welcome to Cowork',
  body: 'Welcome to Cowork, your autonomous workspace. Here is a quick 30 second tour of how it works.',
};

const OUTRO: TourStep = {
  id: 'outro',
  title: 'You are all set',
  body: 'That is it. Give your coworker a goal and let it run. You can replay this tour anytime from the sidebar.',
};

const PHASE1_STEPS: TourStep[] = [
  INTRO,
  {
    id: 'new-project',
    selector: '[data-tour-id="cowork-new-project"]',
    title: 'New project',
    body: 'Start here. A project is an isolated workspace with its own chats, files, skills, connectors, and routines. Create one for each initiative you want the coworker to handle.',
    placement: 'right',
  },
  {
    id: 'connectors',
    selector: '[data-tour-id="cowork-connectors"]',
    title: 'Connectors',
    body: 'Connect your tools once (WordPress, Airtable, Mailchimp, Outlook, Canva, web search, and more). A connected tool is available to the coworker across all your projects in Agent mode.',
    placement: 'right',
  },
];

const PHASE2_STEPS: TourStep[] = [
  {
    id: 'chat-list',
    selector: '[data-tour-id="cowork-chat-list"]',
    title: 'Your chats',
    body: 'Every conversation in this project lives here. Open one to pick up where you left off, or start a new one. Your chats will appear in this list.',
    placement: 'bottom',
  },
  {
    id: 'new-chat',
    selector: '[data-tour-id="cowork-new-chat"]',
    title: 'New chat',
    body: 'Kick off a fresh task. Give the coworker a goal and it plans, works, and hands back finished files.',
    placement: 'bottom',
  },
  {
    id: 'model-picker',
    selector: '[data-tour-id="cowork-model-picker"]',
    title: 'Model, locked per chat',
    body: 'Pick the model for a chat here. Once a chat starts, its model is locked for that conversation, so start a new chat if you want to switch models.',
    placement: 'bottom',
  },
  {
    id: 'tab-workspace',
    selector: '[data-tour-id="cowork-tab-workspace"]',
    title: 'Workspace',
    body: "Your project's files. Upload inputs here, and find the deliverables the coworker creates. You can download anything straight from this panel.",
    placement: 'left',
    openPanel: true,
  },
  {
    id: 'tab-trace',
    selector: '[data-tour-id="cowork-tab-trace"]',
    title: 'Trace',
    body: 'Watch the coworker work in real time. Every step it takes, like running code, searching the web, or reading files, shows up here as it happens.',
    placement: 'left',
    openPanel: true,
  },
  {
    id: 'tab-skills',
    selector: '[data-tour-id="cowork-tab-skills"]',
    title: 'Skills',
    body: 'Turn on document skills (Word, PDF, PowerPoint, Excel) so the coworker knows how to produce those file types in this project.',
    placement: 'left',
    openPanel: true,
  },
  {
    id: 'tab-memory',
    selector: '[data-tour-id="cowork-tab-memory"]',
    title: 'Memory',
    body: 'Durable facts and preferences the coworker remembers for this project, carried across every chat so you do not repeat yourself.',
    placement: 'left',
    openPanel: true,
  },
  {
    id: 'tab-routines',
    selector: '[data-tour-id="cowork-tab-routines"]',
    title: 'Routines',
    body: 'Save a prompt to run on a schedule or on demand. Great for hands free automations like a daily briefing or a weekly report.',
    placement: 'left',
    openPanel: true,
  },
  {
    id: 'mode-toggle',
    selector: '[data-tour-id="cowork-mode-toggle"]',
    title: 'Ask, Plan, or Agent',
    body: 'Choose how the coworker responds. Ask answers questions, Plan drafts an approach without touching files, and Agent does the work and writes files.',
    placement: 'top',
    openNewChat: true,
  },
  OUTRO,
];

const CARD_WIDTH = 360;
const GAP = 14;
const PAD = 8;
const RADIUS = 14;
const RETRY_DELAY = 150;
const RETRY_LIMIT = 40;
const START_DELAY = 380;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type Rect = { top: number; left: number; width: number; height: number };

function findTarget(selector?: string): HTMLElement | null {
  if (!selector) {
    return null;
  }
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return (
    els.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) ?? null
  );
}

function spotlightRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  const top = clamp(r.top - PAD, 4, window.innerHeight);
  const left = clamp(r.left - PAD, 4, window.innerWidth);
  const right = clamp(r.right + PAD, 0, window.innerWidth);
  const bottom = clamp(r.bottom + PAD, 0, window.innerHeight);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function cardPosition(
  rect: Rect | null,
  placement: Placement,
  cardHeight: number,
  isCompact: boolean,
) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (rect == null || isCompact) {
    return {
      top: clamp((vh - cardHeight) / 2, 16, Math.max(16, vh - cardHeight - 16)),
      left: clamp((vw - CARD_WIDTH) / 2, 16, Math.max(16, vw - CARD_WIDTH - 16)),
    };
  }

  const maxLeft = Math.max(16, vw - CARD_WIDTH - 16);
  const maxTop = Math.max(16, vh - cardHeight - 16);
  const centeredLeft = clamp(rect.left + rect.width / 2 - CARD_WIDTH / 2, 16, maxLeft);
  const centeredTop = clamp(rect.top + rect.height / 2 - cardHeight / 2, 16, maxTop);
  const order = ([placement, 'right', 'left', 'bottom', 'top'] as Placement[]).filter(
    (value, idx, values) => values.indexOf(value) === idx,
  );

  for (const next of order) {
    if (next === 'right' && rect.left + rect.width + GAP + CARD_WIDTH <= vw - 16) {
      return { top: centeredTop, left: rect.left + rect.width + GAP };
    }
    if (next === 'left' && rect.left - GAP - CARD_WIDTH >= 16) {
      return { top: centeredTop, left: rect.left - GAP - CARD_WIDTH };
    }
    if (next === 'bottom' && rect.top + rect.height + GAP + cardHeight <= vh - 16) {
      return { top: rect.top + rect.height + GAP, left: centeredLeft };
    }
    if (next === 'top' && rect.top - GAP - cardHeight >= 16) {
      return { top: rect.top - GAP - cardHeight, left: centeredLeft };
    }
  }

  return { top: clamp(rect.top + rect.height + GAP, 16, maxTop), left: centeredLeft };
}

const inViewport = (r: DOMRect) =>
  r.top >= 8 && r.left >= 8 && r.bottom <= window.innerHeight - 8 && r.right <= window.innerWidth - 8;

export default function CoworkTour() {
  const { user } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<number | null>(null);
  const startedRef = useRef<string>('');

  const uid = user?.id ?? user?.email ?? user?.username ?? '';
  const keyBase = `cowork-tour:v1:${uid}`;
  const dismissedKey = `${keyBase}:dismissed`;
  const phase1Key = `${keyBase}:phase1done`;
  const phase2Key = `${keyBase}:phase2done`;

  const projectId = useMemo(
    () => location.pathname.match(/^\/cowork\/([^/?]+)/)?.[1],
    [location.pathname],
  );
  const phase: 1 | 2 = projectId ? 2 : 1;
  const steps = phase === 1 ? PHASE1_STEPS : PHASE2_STEPS;

  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [replayNonce, setReplayNonce] = useState(0);
  const [cardHeight, setCardHeight] = useState(200);
  const [isCompact, setIsCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 960px)').matches,
  );
  const step = steps[index];

  const readFlag = useCallback((k: string) => {
    try {
      return localStorage.getItem(k) === 'true';
    } catch {
      return false;
    }
  }, []);
  const writeFlag = useCallback((k: string) => {
    try {
      localStorage.setItem(k, 'true');
    } catch {
      /* ignore */
    }
  }, []);
  const removeFlag = useCallback((k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }, []);

  const clearRetry = useCallback(() => {
    if (retryRef.current != null) {
      window.clearTimeout(retryRef.current);
      retryRef.current = null;
    }
  }, []);

  // The tour control functions are plain (recreated each render) so they always close over the
  // CURRENT phase and route — memoizing them would capture a stale phase and, for example, write
  // the Phase 1 completion flag while finishing Phase 2. Hoisting lets them reference each other.
  function finish(dismiss: boolean) {
    clearRetry();
    setOpen(false);
    if (dismiss) {
      writeFlag(dismissedKey);
    } else {
      writeFlag(phase === 1 ? phase1Key : phase2Key);
    }
  }

  function runPre(s: TourStep | undefined) {
    if (s == null) {
      return;
    }
    if (s.openPanel) {
      window.dispatchEvent(new CustomEvent('cowork-tour-open-panel'));
    }
    if (s.openNewChat && projectId) {
      setOpen(false);
      navigate(`/cowork/${projectId}?new=${Date.now()}`);
    }
  }

  // Locate a step's target (retrying while panels / chats mount), then show it. Steps with no
  // selector (intro / outro) render as a centered card. `stepsList` is passed explicitly so a
  // queued retry always resolves against the phase it was started for.
  function locate(stepsList: TourStep[], i: number, attempt = 0) {
    clearRetry();
    const s = stepsList[i];
    if (s == null) {
      return;
    }
    if (!s.selector) {
      setIndex(i);
      setOpen(true);
      setTick((t) => t + 1);
      return;
    }
    const el = findTarget(s.selector);
    if (el != null) {
      if (!inViewport(el.getBoundingClientRect())) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
      setIndex(i);
      setOpen(true);
      setTick((t) => t + 1);
      return;
    }
    if (attempt >= RETRY_LIMIT) {
      // Target never appeared: skip ahead so the tour never gets stuck.
      const next = i + 1;
      if (next >= stepsList.length) {
        finish(false);
      } else {
        runPre(stepsList[next]);
        locate(stepsList, next);
      }
      return;
    }
    retryRef.current = window.setTimeout(() => locate(stepsList, i, attempt + 1), RETRY_DELAY);
  }

  function goNext(stepsList: TourStep[], fromIndex: number) {
    const next = fromIndex + 1;
    if (next >= stepsList.length) {
      finish(false);
      return;
    }
    runPre(stepsList[next]);
    locate(stepsList, next);
  }

  function goBack() {
    if (index <= 0) {
      return;
    }
    runPre(steps[index - 1]);
    locate(steps, index - 1);
  }

  // Auto-start each phase once, the first time its page is shown (unless dismissed / done).
  // `replayNonce` lets the replay button re-trigger this even on the same route.
  useEffect(() => {
    if (!uid) {
      return;
    }
    if (readFlag(dismissedKey)) {
      setOpen(false);
      return;
    }
    const doneKey = phase === 1 ? phase1Key : phase2Key;
    if (readFlag(doneKey)) {
      setOpen(false);
      return;
    }
    const signature = `${phase}:${projectId ?? ''}:${replayNonce}`;
    if (startedRef.current === signature) {
      return;
    }
    startedRef.current = signature;
    setIndex(0);
    const timer = window.setTimeout(() => {
      runPre(steps[0]);
      locate(steps, 0);
    }, START_DELAY);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, phase, projectId, replayNonce]);

  // Replay (from the sidebar "Take a tour" button): clear the flags and restart from the intro on
  // the Cowork home. Navigating home and/or bumping the nonce re-fires the auto-start effect.
  useEffect(() => {
    const onReplay = () => {
      clearRetry();
      removeFlag(dismissedKey);
      removeFlag(phase1Key);
      removeFlag(phase2Key);
      startedRef.current = '';
      setOpen(false);
      setIndex(0);
      if (projectId) {
        navigate('/cowork');
      }
      setReplayNonce((n) => n + 1);
    };
    window.addEventListener('cowork-tour-replay', onReplay);
    return () => window.removeEventListener('cowork-tour-replay', onReplay);
  }, [clearRetry, removeFlag, dismissedKey, phase1Key, phase2Key, projectId, navigate]);

  // Reposition on resize / scroll while open.
  useEffect(() => {
    if (!open) {
      return;
    }
    const refresh = () => setTick((t) => t + 1);
    const mq = window.matchMedia('(max-width: 960px)');
    const onMq = () => setIsCompact(mq.matches);
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);
    mq.addEventListener?.('change', onMq);
    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
      mq.removeEventListener?.('change', onMq);
    };
  }, [open]);

  // Keyboard: Esc dismisses, arrows navigate.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finish(true);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext(steps, index);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, steps]);

  // Clear any pending retry on unmount.
  useEffect(() => clearRetry, [clearRetry]);

  const rect = useMemo(() => {
    if (!open || step == null || !step.selector) {
      return null;
    }
    const el = findTarget(step.selector);
    return el != null ? spotlightRect(el) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, tick]);

  useLayoutEffect(() => {
    if (cardRef.current != null) {
      setCardHeight(cardRef.current.getBoundingClientRect().height);
    }
  }, [index, open, tick]);

  if (!uid || !open || step == null) {
    return null;
  }

  const pos = cardPosition(rect, step.placement ?? 'bottom', cardHeight, isCompact);
  const isLast = index === steps.length - 1;

  return createPortal(
    <div className="first-login-tour">
      <svg
        className="first-login-tour-overlay"
        viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <mask id="cowork-tour-mask">
            <rect width={window.innerWidth} height={window.innerHeight} fill="white" />
            {rect != null && (
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx={RADIUS}
                ry={RADIUS}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          className="first-login-tour-overlay-fill"
          width={window.innerWidth}
          height={window.innerHeight}
          mask="url(#cowork-tour-mask)"
        />
      </svg>

      {rect != null && (
        <motion.div
          className="first-login-tour-spotlight"
          initial={false}
          animate={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius: RADIUS,
          }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        />
      )}

      <motion.div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        className="first-login-tour-card"
        style={{ width: CARD_WIDTH }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, top: pos.top, left: pos.left }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        <div className="first-login-tour-card-header">
          <div>
            <p className="first-login-tour-step-label">Cowork tour</p>
            <p className="first-login-tour-step-count">
              {index + 1} / {steps.length}
            </p>
          </div>
          <button type="button" className="first-login-tour-skip" onClick={() => finish(true)}>
            Skip
          </button>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            className="first-login-tour-card-body"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <h2 className="first-login-tour-title">{step.title}</h2>
            <p className="first-login-tour-description">{step.body}</p>
          </motion.div>
        </AnimatePresence>
        <div className="first-login-tour-card-footer">
          <button
            type="button"
            className="first-login-tour-secondary"
            onClick={goBack}
            disabled={index === 0}
          >
            Back
          </button>
          <button
            type="button"
            className="first-login-tour-primary"
            onClick={() => goNext(steps, index)}
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
