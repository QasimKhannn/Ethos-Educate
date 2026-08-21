/* eslint-disable i18next/no-literal-string */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Download,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  Button,
  Checkbox,
  Label,
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  Textarea,
} from '@librechat/client';
import { Permissions, PermissionTypes } from 'librechat-data-provider';
import { useHasAccess } from '~/hooks';
import { useBadgeRowContext, useAgentsMapContext } from '~/Providers';
import { useGetAgentByIdQuery } from '~/data-provider';
import { cn } from '~/utils';
import {
  LESSON_PLANNING_DURATION_OPTIONS,
  LESSON_PLANNING_SCOPE_OPTIONS,
  LESSON_PLANNING_SERVER_NAME,
  agentHasLessonPlanningMcp,
  defaultLessonPlanningLaunchForm,
  isLessonPlanningAgentLabel,
  isLessonPlanningServerName,
  parseFrameworks,
  type LessonPlanningLaunchForm,
  type LessonPlanningOption,
} from './lessonPlanningUtils';

const DEFAULT_LESSON_API_BASE = 'https://backend-lesson-3fixl7mkma-uc.a.run.app';
const SHORT_REQUEST_TIMEOUT_MS = 45000;
const LONG_REQUEST_TIMEOUT_MS = 310000;

type WizardStep = 'setup' | 'unit' | 'choices' | 'complete';
type BusyPhase = 'initial' | 'subjects' | 'grades' | 'units' | 'suggestions' | 'generate' | null;

interface LessonPlanningLauncherProps {
  agentId?: string | null;
  isAgentConversation?: boolean;
  displayMode?: 'button' | 'embedded';
}

interface LessonPlanningDropdownProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: LessonPlanningOption[];
  isOpen: boolean;
  disabled?: boolean;
  helperText?: string;
  className?: string;
  onChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
}

interface LessonPlanningChoice extends LessonPlanningOption {
  description?: string;
  standardRole?: string;
  benchmarkLevel?: string;
}

interface LessonPlanningCatalog {
  states: LessonPlanningOption[];
  frameworks: LessonPlanningOption[];
  subjects: LessonPlanningOption[];
  grades: LessonPlanningOption[];
}

interface LessonPlanningResult {
  status?: string;
  unit?: string;
  preview?: Record<string, unknown>;
  download_url?: string;
  absolute_download_url?: string;
  supporting_resources_used?: boolean;
}

const emptyCatalog: LessonPlanningCatalog = {
  states: [],
  frameworks: [],
  subjects: [],
  grades: [],
};

function normalizeOption(item: unknown): LessonPlanningOption | null {
  if (typeof item === 'string') {
    return { label: item, value: item };
  }

  if (!item || typeof item !== 'object') {
    return null;
  }

  const record = item as Record<string, unknown>;
  const label =
    typeof record.label === 'string'
      ? record.label
      : typeof record.title === 'string'
        ? record.title
        : '';
  const value = typeof record.value === 'string' ? record.value : label;

  return label ? { label, value } : null;
}

function normalizeChoice(item: unknown): LessonPlanningChoice | null {
  const option = normalizeOption(item);
  if (!option || !item || typeof item !== 'object') {
    return option;
  }

  const record = item as Record<string, unknown>;
  return {
    ...option,
    description: typeof record.description === 'string' ? record.description : undefined,
    standardRole: typeof record.standard_role === 'string' ? record.standard_role : undefined,
    benchmarkLevel: typeof record.benchmark_level === 'string' ? record.benchmark_level : undefined,
  };
}

function normalizeOptions(items: unknown): LessonPlanningOption[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(normalizeOption).filter((item): item is LessonPlanningOption => item != null);
}

function normalizeChoices(items: unknown): LessonPlanningChoice[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(normalizeChoice).filter((item): item is LessonPlanningChoice => item != null);
}

function mcpHttpBase(url?: string): string | null {
  if (!url) {
    return null;
  }

  return url.replace(/\/mcp\/?$/i, '').replace(/\/$/, '');
}

function deriveLessonApiBase(mcpUrl?: string): string {
  const httpBase = mcpHttpBase(mcpUrl);
  if (!httpBase) {
    return DEFAULT_LESSON_API_BASE;
  }

  try {
    const url = new URL(httpBase);
    url.hostname = url.hostname
      .replace(/^lesson-planning-mcp/i, 'backend-lesson')
      .replace(/^nei-lesson-planning-mcp/i, 'nei-backend-lesson');
    return url.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_LESSON_API_BASE;
  }
}

function serverConfigUrl(server: unknown): string | undefined {
  const config = (server as { config?: unknown } | null | undefined)?.config;
  if (!config || typeof config !== 'object' || !('url' in config)) {
    return undefined;
  }

  const url = (config as { url?: unknown }).url;
  return typeof url === 'string' ? url : undefined;
}

async function requestJson<T>(
  apiBase: string,
  path: string,
  options: RequestInit = {},
  timeoutMs = SHORT_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const url = new URL(path, apiBase);

  try {
    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({ detail: response.statusText }));

    if (!response.ok) {
      const detail =
        payload && typeof payload === 'object' && 'detail' in payload
          ? String((payload as { detail?: unknown }).detail)
          : response.statusText;
      throw new Error(detail || 'Lesson planning request failed.');
    }

    return payload as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function dropdownPath(path: string, params?: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function selectedLabel(options: LessonPlanningOption[], value: string, fallback = value): string {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

function resolveDownloadUrl(apiBase: string, result: LessonPlanningResult): string {
  const downloadUrl = result.absolute_download_url || result.download_url || '';
  if (!downloadUrl) {
    return '';
  }

  try {
    return new URL(downloadUrl, apiBase).toString();
  } catch {
    return downloadUrl;
  }
}

function isSpecialsOrElectives(subject: string): boolean {
  const normalized = subject.trim().toLowerCase();
  return normalized.includes('specials') || normalized.includes('electives');
}

function frameworkDescription(option: LessonPlanningOption): string {
  const normalized = `${option.label} ${option.value}`.toLowerCase();

  if (normalized.includes('avid')) {
    return 'Adds WICOR routines: writing, inquiry, collaboration, organization, and reading.';
  }
  if (normalized.includes('baccalaureate') || normalized === 'ib') {
    return 'Adds inquiry, learner profile connections, global context, and reflection.';
  }
  if (normalized.includes('classical')) {
    return 'Adds knowledge-building, discussion, virtue, and structured teacher clarity.';
  }

  return 'Adds instructional guidance for this school framework.';
}

function formatStrategyForGenerate(choice: LessonPlanningChoice): string {
  if (choice.description && choice.description !== choice.label) {
    return `${choice.label}: ${choice.description}`;
  }
  return choice.label;
}

function LessonPlanningDropdown({
  id,
  label,
  value,
  placeholder,
  options,
  isOpen,
  disabled = false,
  helperText,
  className,
  onChange,
  onOpenChange,
}: LessonPlanningDropdownProps) {
  const labelText = selectedLabel(options, value, placeholder);

  return (
    <div className={cn('relative space-y-1.5', className)}>
      <Label id={`${id}-label`} className="text-sm font-medium text-text-primary">
        {label}
      </Label>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${id}-label ${id}`}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) {
            onOpenChange(!isOpen);
          }
        }}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-xl border border-border-medium bg-surface-primary px-3 py-2 text-left text-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50',
          'disabled:cursor-not-allowed disabled:opacity-55',
          value ? 'text-text-primary' : 'text-text-secondary',
        )}
      >
        <span className="truncate">{labelText}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {helperText && <p className="text-xs text-text-secondary">{helperText}</p>}
      {isOpen && (
        <div
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute left-0 right-0 top-full z-[220] mt-1 max-h-64 overflow-y-auto rounded-xl border border-border-medium bg-surface-primary p-1 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="option"
            aria-selected={value === ''}
            className={cn(
              'w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-secondary',
              value === '' && 'bg-surface-secondary font-medium',
            )}
            onClick={() => {
              onChange('');
              onOpenChange(false);
            }}
          >
            {placeholder}
          </button>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              className={cn(
                'w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-secondary',
                value === option.value && 'bg-surface-secondary font-medium',
              )}
              onClick={() => {
                onChange(option.value);
                onOpenChange(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressCard({
  label,
  value,
  active,
  complete,
}: {
  label: string;
  value: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 text-sm transition-colors',
        active
          ? 'border-sky-500/60 bg-sky-500/10'
          : complete
            ? 'border-emerald-500/40 bg-emerald-500/10'
            : 'border-border-light bg-surface-primary',
      )}
    >
      <div className="font-semibold text-text-primary">{label}</div>
      <div className="text-xs text-text-secondary">{value}</div>
    </div>
  );
}

function LoadingPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 text-sm text-text-primary">
      <Loader2 className="h-4 w-4 animate-spin text-sky-500" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

function ChoiceCard({
  choice,
  selected,
  multi = false,
  onClick,
}: {
  choice: LessonPlanningChoice;
  selected: boolean;
  multi?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50',
        selected
          ? 'border-sky-500/70 bg-sky-500/15 shadow-sm'
          : 'border-border-light bg-surface-primary hover:border-sky-500/35 hover:bg-surface-secondary',
      )}
    >
      {multi ? (
        <Checkbox
          aria-label={`Select ${choice.label}`}
          checked={selected}
          onCheckedChange={onClick}
          onClick={(event) => event.stopPropagation()}
          className="mt-0.5"
        />
      ) : (
        <span
          className={cn(
            'mt-0.5 h-4 w-4 rounded-full border transition-colors',
            selected ? 'border-sky-400 bg-sky-400' : 'border-border-medium',
          )}
          aria-hidden="true"
        />
      )}
      <span className="space-y-1">
        <span className="block font-semibold text-text-primary">{choice.label}</span>
        {choice.description && choice.description !== choice.label && (
          <span className="block text-sm text-text-secondary">{choice.description}</span>
        )}
        {(choice.standardRole || choice.benchmarkLevel) && (
          <span className="block text-xs uppercase tracking-wide text-text-secondary">
            {[choice.standardRole, choice.benchmarkLevel].filter(Boolean).join(' / ')}
          </span>
        )}
      </span>
    </div>
  );
}

function LessonPlanningLauncher({
  agentId,
  isAgentConversation = false,
  displayMode = 'button',
}: LessonPlanningLauncherProps) {
  const isEmbedded = displayMode === 'embedded';
  const canUseMcp = useHasAccess({
    permissionType: PermissionTypes.MCP_SERVERS,
    permission: Permissions.USE,
  });
  const { mcpServerManager } = useBadgeRowContext();
  const { availableMCPServers, mcpValues, setMCPValues, isInitializing } = mcpServerManager;
  const agentsMap = useAgentsMapContext();

  const [isOpen, setIsOpen] = useState(isEmbedded);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [apiBase, setApiBase] = useState(DEFAULT_LESSON_API_BASE);
  const [busyPhase, setBusyPhase] = useState<BusyPhase>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<WizardStep>('setup');
  const [catalog, setCatalog] = useState<LessonPlanningCatalog>(emptyCatalog);
  const [units, setUnits] = useState<LessonPlanningChoice[]>([]);
  const [benchmarks, setBenchmarks] = useState<LessonPlanningChoice[]>([]);
  const [strategies, setStrategies] = useState<LessonPlanningChoice[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<LessonPlanningChoice | null>(null);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>([]);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [result, setResult] = useState<LessonPlanningResult | null>(null);
  const [formValues, setFormValues] = useState<LessonPlanningLaunchForm>(
    defaultLessonPlanningLaunchForm(),
  );
  const previousServerSelectionRef = useRef<string[]>([]);
  const embeddedInitializedRef = useRef(false);

  const lessonPlanningServer = useMemo(
    () =>
      availableMCPServers.find((server) => isLessonPlanningServerName(server.serverName)) ?? null,
    [availableMCPServers],
  );

  const lessonPlanningServerName = lessonPlanningServer?.serverName ?? LESSON_PLANNING_SERVER_NAME;
  const lessonPlanningMcpUrl = serverConfigUrl(lessonPlanningServer);
  const mappedAgent = agentId ? agentsMap?.[agentId] : undefined;
  const shouldFetchAgent =
    isAgentConversation === true &&
    Boolean(agentId) &&
    (!Array.isArray(mappedAgent?.tools) || mappedAgent.tools.length === 0);
  const { data: fetchedAgent } = useGetAgentByIdQuery(agentId, {
    enabled: shouldFetchAgent,
  });
  const activeAgent = fetchedAgent ?? mappedAgent;
  const activeAgentTools = activeAgent?.tools;
  const activeAgentRecord = activeAgent as Record<string, unknown> | undefined;
  const hasLessonPlanningMcp = useMemo(
    () =>
      isAgentConversation === true &&
      Boolean(agentId) &&
      agentHasLessonPlanningMcp(activeAgentTools, lessonPlanningServerName),
    [activeAgentTools, agentId, isAgentConversation, lessonPlanningServerName],
  );
  const hasLessonPlanningIdentity = useMemo(
    () =>
      isLessonPlanningAgentLabel(
        activeAgentRecord?.name,
        activeAgentRecord?.description,
        activeAgentRecord?.toolkit_description,
      ),
    [activeAgentRecord],
  );
  const isActive = useMemo(
    () => (mcpValues ?? []).some((serverName) => isLessonPlanningServerName(serverName)),
    [mcpValues],
  );
  const isServerBusy = isInitializing(lessonPlanningServerName);
  const isBusy = busyPhase != null;
  const isLessonPlanningAvailable =
    canUseMcp &&
    isAgentConversation &&
    Boolean(agentId) &&
    (hasLessonPlanningMcp || hasLessonPlanningIdentity);
  const isWizardVisible = isLessonPlanningAvailable && (isEmbedded || isOpen);

  const selectedBenchmarkChoices = useMemo(
    () => benchmarks.filter((choice) => selectedBenchmarks.includes(choice.value)),
    [benchmarks, selectedBenchmarks],
  );
  const selectedStrategyChoices = useMemo(
    () => strategies.filter((choice) => selectedStrategies.includes(choice.value)),
    [strategies, selectedStrategies],
  );
  const canContinueSetup =
    Boolean(formValues.state && formValues.subject && formValues.gradeLevel) &&
    Boolean(formValues.lessonDuration && formValues.lessonScope) &&
    !isBusy;
  const canContinueChoices =
    !isBusy &&
    (benchmarks.length === 0 || selectedBenchmarkChoices.length > 0) &&
    (strategies.length === 0 || selectedStrategyChoices.length > 0);

  const resetWizard = useCallback(() => {
    setOpenDropdown(null);
    setApiBase(deriveLessonApiBase(lessonPlanningMcpUrl));
    setBusyPhase(null);
    setError('');
    setStep('setup');
    setCatalog(emptyCatalog);
    setUnits([]);
    setBenchmarks([]);
    setStrategies([]);
    setSelectedUnit(null);
    setSelectedBenchmarks([]);
    setSelectedStrategies([]);
    setResult(null);
    setFormValues(defaultLessonPlanningLaunchForm());
  }, [lessonPlanningMcpUrl]);

  const restartWizard = useCallback(() => {
    const nextFormValues = defaultLessonPlanningLaunchForm();
    const onlyState = catalog.states.length === 1 ? catalog.states[0].value : '';

    setOpenDropdown(null);
    setBusyPhase(null);
    setError('');
    setStep('setup');
    setUnits([]);
    setBenchmarks([]);
    setStrategies([]);
    setSelectedUnit(null);
    setSelectedBenchmarks([]);
    setSelectedStrategies([]);
    setResult(null);
    setFormValues({ ...nextFormValues, state: onlyState });
  }, [catalog.states]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        resetWizard();
        const currentValues = mcpValues ?? [];
        previousServerSelectionRef.current = currentValues.filter(
          (serverName) => !isLessonPlanningServerName(serverName),
        );
        setMCPValues([lessonPlanningServerName]);
      }

      setOpenDropdown(null);
      setIsOpen(open);
    },
    [lessonPlanningServerName, mcpValues, resetWizard, setMCPValues],
  );

  useEffect(() => {
    embeddedInitializedRef.current = false;
  }, [agentId, isEmbedded, lessonPlanningServerName]);

  useEffect(() => {
    if (
      !isEmbedded ||
      embeddedInitializedRef.current ||
      !canUseMcp ||
      !isAgentConversation ||
      !agentId ||
      !isLessonPlanningAvailable
    ) {
      return;
    }

    embeddedInitializedRef.current = true;
    resetWizard();
    previousServerSelectionRef.current = (mcpValues ?? []).filter(
      (serverName) => !isLessonPlanningServerName(serverName),
    );
    setMCPValues([lessonPlanningServerName]);
    setIsOpen(true);
  }, [
    agentId,
    canUseMcp,
    isAgentConversation,
    isEmbedded,
    isLessonPlanningAvailable,
    lessonPlanningServerName,
    mcpValues,
    resetWizard,
    setMCPValues,
  ]);

  const setFieldValue = useCallback(
    (field: keyof LessonPlanningLaunchForm) => (value: string) => {
      setFormValues((current) => {
        const next = { ...current, [field]: value };

        if (field === 'state') {
          next.subject = '';
          next.gradeLevel = '';
        }
        if (field === 'subject') {
          next.gradeLevel = '';
        }

        return next;
      });

      setError('');
      setUnits([]);
      setBenchmarks([]);
      setStrategies([]);
      setSelectedUnit(null);
      setSelectedBenchmarks([]);
      setSelectedStrategies([]);
      setResult(null);
    },
    [],
  );

  const handleFieldChange = useCallback(
    (field: keyof LessonPlanningLaunchForm) => (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setFormValues((current) => ({ ...current, [field]: event.target.value }));
    },
    [],
  );

  const handleFrameworkToggle = useCallback((framework: string, checked: boolean) => {
    setFormValues((current) => {
      const nextFrameworks = checked
        ? [...current.frameworks, framework]
        : current.frameworks.filter((item) => item !== framework);
      return { ...current, frameworks: nextFrameworks };
    });
  }, []);

  const toggleBenchmark = useCallback((choice: LessonPlanningChoice) => {
    setSelectedBenchmarks((current) =>
      current.includes(choice.value)
        ? current.filter((item) => item !== choice.value)
        : [...current, choice.value],
    );
  }, []);

  const toggleStrategy = useCallback((choice: LessonPlanningChoice) => {
    setSelectedStrategies((current) =>
      current.includes(choice.value)
        ? current.filter((item) => item !== choice.value)
        : [...current, choice.value],
    );
  }, []);

  useEffect(() => {
    if (!isWizardVisible) {
      return;
    }

    let isCancelled = false;
    const base = deriveLessonApiBase(lessonPlanningMcpUrl);
    setApiBase(base);
    setBusyPhase('initial');
    setError('');

    Promise.all([
      requestJson<unknown>(base, '/api/dropdowns/states'),
      requestJson<unknown>(base, '/api/dropdowns/frameworks'),
    ])
      .then(([statePayload, frameworkPayload]) => {
        if (isCancelled) {
          return;
        }

        const states = normalizeOptions(statePayload);
        const frameworks = normalizeOptions(frameworkPayload).filter(
          (framework) => framework.value.trim().toLowerCase() !== 'wicor overview',
        );

        setCatalog((current) => ({ ...current, states, frameworks }));
        if (states.length === 1) {
          setFormValues((current) => ({ ...current, state: states[0].value }));
        }
      })
      .catch((requestError) => {
        if (!isCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Could not load lesson-planning options.',
          );
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setBusyPhase(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isWizardVisible, lessonPlanningMcpUrl]);

  useEffect(() => {
    if (!isWizardVisible || !formValues.state) {
      return;
    }

    let isCancelled = false;
    setBusyPhase('subjects');
    setError('');

    requestJson<unknown>(
      apiBase,
      dropdownPath('/api/dropdowns/subjects', { state: formValues.state }),
    )
      .then((payload) => {
        if (!isCancelled) {
          setCatalog((current) => ({
            ...current,
            subjects: normalizeOptions(payload),
            grades: [],
          }));
        }
      })
      .catch((requestError) => {
        if (!isCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Could not load subjects for the selected state.',
          );
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setBusyPhase(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [apiBase, formValues.state, isWizardVisible]);

  useEffect(() => {
    if (!isWizardVisible || !formValues.state || !formValues.subject) {
      return;
    }

    let isCancelled = false;
    setBusyPhase('grades');
    setError('');

    requestJson<unknown>(
      apiBase,
      dropdownPath('/api/dropdowns/grades', {
        state: formValues.state,
        subject: formValues.subject,
      }),
    )
      .then((payload) => {
        if (!isCancelled) {
          setCatalog((current) => ({ ...current, grades: normalizeOptions(payload) }));
        }
      })
      .catch((requestError) => {
        if (!isCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Could not load grades for the selected subject.',
          );
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setBusyPhase(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [apiBase, formValues.state, formValues.subject, isWizardVisible]);

  const loadUnits = useCallback(async () => {
    if (!canContinueSetup) {
      setError('Choose state, subject, grade, duration, and lesson scope before continuing.');
      return;
    }

    setStep('unit');
    setBusyPhase('units');
    setError('');
    setUnits([]);
    setSelectedUnit(null);
    setBenchmarks([]);
    setStrategies([]);
    setSelectedBenchmarks([]);
    setSelectedStrategies([]);
    setResult(null);

    try {
      const payload = await requestJson<unknown>(
        apiBase,
        dropdownPath('/api/dropdowns/units', {
          state: formValues.state,
          subject: formValues.subject,
          grade_level: formValues.gradeLevel,
        }),
      );
      const nextUnits = normalizeChoices(payload);

      if (nextUnits.length === 0 && !isSpecialsOrElectives(formValues.subject)) {
        setError(
          `No units were returned for ${formValues.state} / ${formValues.subject} / ${formValues.gradeLevel}.`,
        );
        return;
      }

      setUnits(nextUnits);

      if (nextUnits.length === 0) {
        setStep('choices');
        setBusyPhase('suggestions');
        const suggestions = await requestJson<Record<string, unknown>>(
          apiBase,
          '/api/generate-suggestions',
          {
            method: 'POST',
            body: JSON.stringify({
              state: formValues.state,
              subject: formValues.subject,
              grade_level: formValues.gradeLevel,
              lesson_scope: formValues.lessonScope,
            }),
          },
          LONG_REQUEST_TIMEOUT_MS,
        );
        setBenchmarks(normalizeChoices(suggestions.benchmarks));
        setStrategies(normalizeChoices(suggestions.engagement_strategies));
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Could not load matching units.',
      );
    } finally {
      setBusyPhase(null);
    }
  }, [apiBase, canContinueSetup, formValues]);

  const loadSuggestions = useCallback(async () => {
    if (!selectedUnit && !isSpecialsOrElectives(formValues.subject)) {
      setError('Choose one curriculum unit before continuing.');
      return;
    }

    setStep('choices');
    setBusyPhase('suggestions');
    setError('');
    setBenchmarks([]);
    setStrategies([]);
    setSelectedBenchmarks([]);
    setSelectedStrategies([]);
    setResult(null);

    try {
      const payload = selectedUnit
        ? { unit_document_id: selectedUnit.value, lesson_scope: formValues.lessonScope }
        : {
            state: formValues.state,
            subject: formValues.subject,
            grade_level: formValues.gradeLevel,
            lesson_scope: formValues.lessonScope,
          };
      const suggestions = await requestJson<Record<string, unknown>>(
        apiBase,
        '/api/generate-suggestions',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        LONG_REQUEST_TIMEOUT_MS,
      );

      setBenchmarks(normalizeChoices(suggestions.benchmarks));
      setStrategies(normalizeChoices(suggestions.engagement_strategies));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not generate benchmark and strategy choices.',
      );
    } finally {
      setBusyPhase(null);
    }
  }, [apiBase, formValues, selectedUnit]);

  const generateLesson = useCallback(async () => {
    if (!canContinueChoices) {
      setError('Select at least one benchmark and one engagement strategy before generating.');
      return;
    }

    setBusyPhase('generate');
    setError('');
    setResult(null);

    const frameworks = parseFrameworks(formValues.frameworks);
    const selectedStrategyText = selectedStrategyChoices.map(formatStrategyForGenerate);

    try {
      const lessonResult = await requestJson<LessonPlanningResult>(
        apiBase,
        '/api/generate-lesson-with-supporting-resources',
        {
          method: 'POST',
          body: JSON.stringify({
            state: formValues.state,
            subject: formValues.subject,
            grade_level: formValues.gradeLevel,
            frameworks,
            framework: frameworks.join(', '),
            school_type: frameworks.join(', ') || 'General Education',
            lesson_duration: formValues.lessonDuration,
            lesson_scope: formValues.lessonScope,
            selected_benchmarks: selectedBenchmarkChoices.map((choice) => choice.label),
            selected_engagement_strategies: selectedStrategyText,
            engagement_strategy: selectedStrategyText.join('\n'),
            teacher_notes: formValues.teacherNotes,
            unit_document_id: selectedUnit?.value,
            use_supporting_resources: true,
          }),
        },
        LONG_REQUEST_TIMEOUT_MS,
      );

      setResult(lessonResult);
      setStep('complete');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Lesson generation failed.');
    } finally {
      setBusyPhase(null);
    }
  }, [
    apiBase,
    canContinueChoices,
    formValues,
    selectedBenchmarkChoices,
    selectedStrategyChoices,
    selectedUnit,
  ]);

  const handleDisable = useCallback(() => {
    const currentValues = mcpValues ?? [];
    const valuesWithoutLessonPlanning = currentValues.filter(
      (serverName) => !isLessonPlanningServerName(serverName),
    );
    const restoredValues =
      valuesWithoutLessonPlanning.length > 0
        ? valuesWithoutLessonPlanning
        : previousServerSelectionRef.current;

    setMCPValues(restoredValues);
    setIsOpen(false);
  }, [mcpValues, setMCPValues]);

  if (!isLessonPlanningAvailable) {
    return null;
  }

  const downloadUrl = result ? resolveDownloadUrl(apiBase, result) : '';
  const setupActionBusy = busyPhase === 'units';
  const focusActionBusy = busyPhase === 'suggestions';
  const generateActionBusy = busyPhase === 'generate';

  const wizardBody = (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border-light bg-surface-secondary p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-500">
              {step === 'setup'
                ? 'Enter lesson details'
                : step === 'unit'
                  ? 'Choose curriculum unit'
                  : step === 'choices'
                    ? 'Choose lesson focus'
                    : 'Lesson plan ready'}
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              {step === 'setup'
                ? 'Choose the state, subject, grade, frameworks, duration, and lesson scope.'
                : step === 'unit'
                  ? 'Choose one matching unit for the selected course.'
                  : step === 'choices'
                    ? 'Select benchmarks and engagement strategies, then generate the DOCX.'
                    : 'Download the finished lesson plan or start another plan.'}
            </p>
          </div>
          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-600 dark:text-sky-200">
            Lesson-planning only
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ProgressCard
            label="1. Lesson details"
            value={step === 'setup' ? 'Choose basics' : 'Ready'}
            active={step === 'setup'}
            complete={step !== 'setup'}
          />
          <ProgressCard
            label="2. Curriculum unit"
            value={step === 'unit' ? 'Pick one unit' : selectedUnit ? 'Ready' : 'Next'}
            active={step === 'unit'}
            complete={Boolean(selectedUnit) || step === 'choices' || step === 'complete'}
          />
          <ProgressCard
            label="3. Benchmarks & strategies"
            value={step === 'choices' ? 'Choose focus' : step === 'complete' ? 'Ready' : 'Next'}
            active={step === 'choices'}
            complete={step === 'complete'}
          />
        </div>
      </div>

      {error && <ErrorPanel message={error} />}
      {busyPhase === 'initial' && (
        <LoadingPanel>Loading live lesson-planning options...</LoadingPanel>
      )}
      {busyPhase === 'subjects' && (
        <LoadingPanel>Loading subjects for the selected state...</LoadingPanel>
      )}
      {busyPhase === 'grades' && (
        <LoadingPanel>Loading grades and courses for the selected subject...</LoadingPanel>
      )}
      {busyPhase === 'units' && <LoadingPanel>Finding matching curriculum units...</LoadingPanel>}
      {busyPhase === 'suggestions' && (
        <LoadingPanel>
          Planning benchmark and engagement choices from the selected unit...
        </LoadingPanel>
      )}
      {busyPhase === 'generate' && (
        <LoadingPanel>
          Generating the formatted lesson plan DOCX. This can take a few minutes.
        </LoadingPanel>
      )}

      {step === 'setup' && (
        <div className="grid gap-5 md:grid-cols-2">
          <LessonPlanningDropdown
            id="lesson-planning-state"
            label="State"
            value={formValues.state}
            placeholder="Choose state"
            options={catalog.states}
            isOpen={openDropdown === 'state'}
            disabled={busyPhase === 'initial'}
            onChange={setFieldValue('state')}
            onOpenChange={(open) => setOpenDropdown(open ? 'state' : null)}
          />
          <LessonPlanningDropdown
            id="lesson-planning-subject"
            label="Subject"
            value={formValues.subject}
            placeholder={formValues.state ? 'Choose subject' : 'Choose state first'}
            options={catalog.subjects}
            isOpen={openDropdown === 'subject'}
            disabled={!formValues.state || busyPhase === 'subjects'}
            onChange={setFieldValue('subject')}
            onOpenChange={(open) => setOpenDropdown(open ? 'subject' : null)}
          />
          <LessonPlanningDropdown
            id="lesson-planning-grade"
            label="Grade or course"
            value={formValues.gradeLevel}
            placeholder={formValues.subject ? 'Choose grade or course' : 'Choose subject first'}
            options={catalog.grades}
            isOpen={openDropdown === 'grade'}
            disabled={!formValues.subject || busyPhase === 'grades'}
            onChange={setFieldValue('gradeLevel')}
            onOpenChange={(open) => setOpenDropdown(open ? 'grade' : null)}
          />
          <LessonPlanningDropdown
            id="lesson-planning-duration"
            label="Preferred lesson duration"
            value={formValues.lessonDuration}
            placeholder="Choose duration"
            options={LESSON_PLANNING_DURATION_OPTIONS}
            isOpen={openDropdown === 'duration'}
            onChange={setFieldValue('lessonDuration')}
            onOpenChange={(open) => setOpenDropdown(open ? 'duration' : null)}
          />
          <LessonPlanningDropdown
            id="lesson-planning-scope"
            label="Lesson scope"
            value={formValues.lessonScope}
            placeholder="Choose lesson scope"
            options={LESSON_PLANNING_SCOPE_OPTIONS}
            isOpen={openDropdown === 'scope'}
            className="md:col-span-2"
            helperText="This controls whether the DOCX uses the one-day, five-day, or full-unit template."
            onChange={setFieldValue('lessonScope')}
            onOpenChange={(open) => setOpenDropdown(open ? 'scope' : null)}
          />

          <div className="space-y-2 md:col-span-2">
            <Label id="lesson-planning-frameworks-label" className="text-sm font-medium">
              School frameworks
              <span className="ml-1 text-xs font-normal text-text-secondary">
                (optional, multi-select)
              </span>
            </Label>
            <div
              id="lesson-planning-frameworks"
              role="group"
              aria-labelledby="lesson-planning-frameworks-label"
              className="grid items-stretch gap-3 md:grid-cols-3"
            >
              {catalog.frameworks.map((framework) => (
                <label
                  key={framework.value}
                  className={cn(
                    'grid min-h-[8.25rem] cursor-pointer grid-cols-[auto,1fr] gap-3 rounded-2xl border p-4 transition-colors',
                    formValues.frameworks.includes(framework.value)
                      ? 'border-sky-500/60 bg-sky-500/10'
                      : 'border-border-light bg-surface-primary hover:bg-surface-secondary',
                  )}
                >
                  <Checkbox
                    aria-label={`Select ${framework.label} framework`}
                    checked={formValues.frameworks.includes(framework.value)}
                    onCheckedChange={(checked) =>
                      handleFrameworkToggle(framework.value, checked === true)
                    }
                    className="mt-0.5"
                  />
                  <span className="grid grid-rows-[2.5rem,1fr]">
                    <span className="block text-sm font-semibold leading-5 text-text-primary">
                      {framework.label}
                    </span>
                    <span className="block text-xs leading-5 text-text-secondary">
                      {frameworkDescription(framework)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="lesson-planning-notes">Teacher notes</Label>
            <Textarea
              id="lesson-planning-notes"
              placeholder="Add goals, accommodations, materials, or classroom context you want included."
              value={formValues.teacherNotes}
              onChange={handleFieldChange('teacherNotes')}
            />
          </div>
        </div>
      )}

      {step === 'unit' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border-light bg-surface-secondary p-4 text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">
              {selectedLabel(catalog.subjects, formValues.subject)} /{' '}
              {selectedLabel(catalog.grades, formValues.gradeLevel)}
            </span>
            <span> - choose the exact unit for this lesson plan.</span>
          </div>

          {units.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {units.map((unit) => (
                <ChoiceCard
                  key={unit.value}
                  choice={unit}
                  selected={selectedUnit?.value === unit.value}
                  onClick={() => {
                    setSelectedUnit(unit);
                    setError('');
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'choices' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border-light bg-surface-secondary p-4 text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">
              {selectedUnit ? selectedUnit.label : 'No unit required'} selected.
            </span>
            <span> Pick one or more benchmarks and engagement strategies.</span>
          </div>

          {benchmarks.length > 0 && (
            <section className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Benchmarks
              </div>
              <div className="grid gap-3">
                {benchmarks.map((benchmark) => (
                  <ChoiceCard
                    key={benchmark.value}
                    choice={benchmark}
                    selected={selectedBenchmarks.includes(benchmark.value)}
                    multi
                    onClick={() => toggleBenchmark(benchmark)}
                  />
                ))}
              </div>
            </section>
          )}

          {strategies.length > 0 && (
            <section className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Engagement strategies
              </div>
              <div className="grid gap-3">
                {strategies.map((strategy) => (
                  <ChoiceCard
                    key={strategy.value}
                    choice={strategy}
                    selected={selectedStrategies.includes(strategy.value)}
                    multi
                    onClick={() => toggleStrategy(strategy)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {step === 'complete' && result && (
        <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Lesson plan ready</h3>
              <p className="text-sm text-text-secondary">
                The formatted DOCX is ready from your selected unit, benchmarks, strategies,
                frameworks, and lesson settings.
              </p>
            </div>
          </div>

          {downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download lesson plan
            </a>
          )}

          <div className="rounded-xl border border-border-light bg-surface-primary p-4 text-sm text-text-secondary">
            Need matching student materials? Download the lesson plan, then upload the DOCX into
            Worksheet Builder to create corresponding worksheets.
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-light pt-4">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <Sparkles className="h-3.5 w-3.5 text-sky-500" aria-hidden="true" />
          <span>
            {isEmbedded
              ? 'This guided planner uses only the lesson-planning MCP.'
              : isActive
                ? 'Lesson planning is active only for this conversation.'
                : 'Opening this keeps the flow isolated to lesson planning.'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {step !== 'setup' && step !== 'complete' && (
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => {
                setError('');
                setStep(step === 'choices' ? 'unit' : 'setup');
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back
            </Button>
          )}
          {!isEmbedded && isActive && (
            <Button type="button" variant="outline" disabled={isBusy} onClick={handleDisable}>
              Turn off lesson planning
            </Button>
          )}
          {!isEmbedded && (
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          )}
          {step === 'setup' && (
            <Button
              type="button"
              variant="submit"
              disabled={!canContinueSetup || setupActionBusy}
              onClick={loadUnits}
            >
              {setupActionBusy && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {setupActionBusy ? 'Finding units...' : 'Continue to units'}
            </Button>
          )}
          {step === 'unit' && (
            <Button
              type="button"
              variant="submit"
              disabled={isBusy || (!selectedUnit && !isSpecialsOrElectives(formValues.subject))}
              onClick={loadSuggestions}
            >
              {focusActionBusy && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {focusActionBusy ? 'Planning choices...' : 'Continue to focus'}
            </Button>
          )}
          {step === 'choices' && (
            <Button
              type="button"
              variant="submit"
              disabled={!canContinueChoices || generateActionBusy}
              onClick={generateLesson}
            >
              {generateActionBusy && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {generateActionBusy ? 'Generating DOCX...' : 'Generate DOCX'}
            </Button>
          )}
          {step === 'complete' && (
            <Button type="button" variant="submit" onClick={restartWizard}>
              Start another plan
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (isEmbedded) {
    return (
      <section
        className="bg-surface-primary/95 mx-auto w-full max-w-5xl rounded-[2rem] border border-border-light p-5 text-left shadow-xl shadow-black/10 sm:p-6"
        aria-label="Lesson Planning"
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Lesson Planning</h2>
              <p className="mt-1 max-w-2xl text-sm text-text-secondary">
                Set up the lesson, choose a matching unit, select the focus, and generate the
                formatted DOCX.
              </p>
            </div>
          </div>
        </div>
        {wizardBody}
      </section>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        disabled={isServerBusy}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-all',
          'shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60',
          isActive
            ? 'border-amber-600/30 bg-amber-500/10 text-amber-900 hover:bg-amber-500/15 dark:text-amber-200'
            : 'border-sky-600/20 bg-sky-500/10 text-sky-900 hover:bg-sky-500/15 dark:text-sky-100',
        )}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <BookOpen className="h-4 w-4" aria-hidden="true" />
        <span className="hidden md:inline">Lesson Planning</span>
        <span className="md:hidden">Lesson</span>
      </button>
      <OGDialog open={isOpen} onOpenChange={handleOpenChange}>
        <OGDialogContent
          className="max-h-[92vh] w-11/12 max-w-4xl overflow-y-auto border-border-light bg-surface-primary"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <OGDialogHeader>
            <OGDialogTitle className="flex items-center gap-2 text-xl text-text-primary">
              <BookOpen className="h-5 w-5 text-sky-500" aria-hidden="true" />
              Lesson Planning
            </OGDialogTitle>
          </OGDialogHeader>
          {wizardBody}
        </OGDialogContent>
      </OGDialog>
    </>
  );
}

export default memo(LessonPlanningLauncher);
