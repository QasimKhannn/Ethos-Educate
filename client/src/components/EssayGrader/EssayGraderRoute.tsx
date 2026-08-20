import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BookOpenCheck,
  ChevronLeft,
  Copy as CopyIcon,
  Eye,
  FileText,
  Loader2,
  Minus,
  MessageSquare,
  Plus,
  Send,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  SpellCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ControlCombobox } from '@librechat/client';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle, useLocalize } from '~/hooks';
import ChatBackgroundLights from '~/components/Chat/ChatBackgroundLights';
import { cn } from '~/utils';
import {
  listRubrics,
  extractDocument,
  fetchToolStatus,
  submitForGrading,
  runGradingMode,
  EssayGraderApiError,
} from './api';
import type {
  ToolStatus,
  CustomRubric,
  GradingMode,
  RubricSummary,
  GradingResponse,
  GradingResultDocument,
  CriterionResult,
} from './types';
import { US_STATES } from './us-states';
import { ModeTabs, TOOL_MODES, MODE_LABEL, modeNeedsRubric } from './ModeTabs';
import { HighlightedText, type TextHighlight } from './HighlightedText';
import { CopyFeedbackDialog } from './CopyFeedbackDialog';

const GRADER_DIRECTIONS_MARKER = '[[ETHOS_GRADER_DIRECTIONS]]';

const GRADING_INSTRUCTION_PRESETS = [
  {
    label: 'Tighten it up',
    instruction: 'Make the feedback more concise and easy to scan — short enough to paste straight into a gradebook comment.',
  },
  {
    label: 'Grade harder',
    instruction: 'Hold the rubric bands to a strict reading and only award credit when the text clearly earns it.',
  },
  { label: 'Translate to', instruction: 'Translate the feedback to: ' },
  {
    label: 'Coach tone',
    instruction:
      'Rewrite the student-facing feedback in an encouraging, coach-like tone while keeping the academic judgement accurate.',
  },
  {
    label: 'Support SLD',
    instruction: 'Adapt the feedback for a student with a specific learning disability: ',
  },
] as const;

const PROOFREAD_INSTRUCTION_PRESETS = [
  {
    label: 'Spelling only',
    instruction:
      'List misspelled or mistyped words only. Scan the entire submission and include every likely misspelling in the Spelling category.',
  },
  { label: 'US spelling', instruction: 'Use US English spelling and punctuation conventions.' },
  {
    label: 'Keep their voice',
    instruction: 'Preserve the student’s voice and meaning; suggest the smallest correction that fixes the issue.',
  },
  { label: 'Short reasons', instruction: 'Keep each correction reason brief and student-friendly.' },
] as const;

/** What the result header's score chip shows when this pass has no points total. */
const MODE_SUMMARY_LABEL: Record<GradingMode, string> = {
  SCORE: 'Not yet scored',
  FEEDBACK: 'Comment-only pass',
  IMPROVE: 'Improve pass',
  PROOFREAD: 'Grammar & spell check',
};

const ADVANCED_RULES = [
  {
    id: 'quote-check',
    label: 'Require exact quoted evidence',
    instruction: 'Only make comments that are supported by exact text evidence from the submission.',
  },
  {
    id: 'one-action',
    label: 'One action per criterion',
    instruction: 'Give one concrete next action per criterion instead of broad advice.',
  },
  {
    id: 'student-ready',
    label: 'Student-ready wording',
    instruction: 'Write feedback directly to the student in specific, encouraging language.',
  },
] as const;

interface CustomCriterionRow {
  key: number;
  name: string;
  description: string;
  maxPoints: number;
}

type EssayGraderStep = 1 | 2 | 3;

const newCriterionRow = (key: number, name = '', maxPoints = 8): CustomCriterionRow => ({
  key,
  name,
  description: '',
  maxPoints,
});

const countWords = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

const numberFormatter = new Intl.NumberFormat();

const EssayGraderRoute = () => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const essayFileInputRef = useRef<HTMLInputElement>(null);
  const rubricFileInputRef = useRef<HTMLInputElement>(null);

  const [rubrics, setRubrics] = useState<RubricSummary[]>([]);
  const [selectedRubricId, setSelectedRubricId] = useState<string>('');
  const [status, setStatus] = useState<ToolStatus | null>(null);
  const [loadingRubrics, setLoadingRubrics] = useState(true);
  const [serviceError, setServiceError] = useState<string | null>(null);
  // 'general' is the small curated set (no state attached). A state code
  // scopes the rubric list to that state only. Rubrics from different states
  // often share a name (e.g. "Grade 3 Literary Analysis"), so listing every
  // state at once made the picker look full of duplicates — this keeps each
  // fetch scoped to one jurisdiction, matching the standalone Co-grader app.
  const [rubricJurisdiction, setRubricJurisdiction] = useState<'general' | string>('general');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [essayText, setEssayText] = useState('');
  const [essayFileName, setEssayFileName] = useState<string | null>(null);
  const [rubricFileName, setRubricFileName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<GradingResponse | null>(null);
  const [activeStep, setActiveStep] = useState<EssayGraderStep>(1);
  const [isCustomRubricModalOpen, setIsCustomRubricModalOpen] = useState(false);
  const [customRubricEnabled, setCustomRubricEnabled] = useState(false);
  const [customRubricName, setCustomRubricName] = useState('');
  const [customRows, setCustomRows] = useState<CustomCriterionRow[]>(() => [
    newCriterionRow(0, 'Ideas and content'),
    newCriterionRow(1, 'Organization', 6),
    newCriterionRow(2, 'Language and conventions', 4),
  ]);
  const [nextRowKey, setNextRowKey] = useState(3);

  useDocumentTitle(localize('com_essay_grader_title'));

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingRubrics(true);
      try {
        const nextStatus = await fetchToolStatus();
        if (!cancelled) setStatus(nextStatus);
      } catch {
        // Rubric loading below reports its own error; the status call is a
        // nice-to-have (engine banner, quota) and shouldn't block the picker.
      } finally {
        if (!cancelled) setLoadingRubrics(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRubrics = async () => {
      setLoadingRubrics(true);
      setServiceError(null);
      try {
        const nextRubrics = await listRubrics(rubricJurisdiction);
        if (cancelled) return;

        setRubrics(nextRubrics);
        setSelectedRubricId((current) =>
          nextRubrics.some((rubric) => rubric.id === current) ? current : nextRubrics[0]?.id || '',
        );
      } catch (cause) {
        if (cancelled) return;

        setServiceError(
          cause instanceof EssayGraderApiError && cause.status !== 0
            ? cause.message
            : localize('com_essay_grader_service_error'),
        );
      } finally {
        if (!cancelled) setLoadingRubrics(false);
      }
    };

    void loadRubrics();

    return () => {
      cancelled = true;
    };
  }, [rubricJurisdiction, localize]);

  const selectedRubric = useMemo(
    () => rubrics.find((rubric) => rubric.id === selectedRubricId) ?? null,
    [rubrics, selectedRubricId],
  );

  const draftCustomRubric = useMemo<CustomRubric | null>(() => {
    const criteria = customRows
      .filter((row) => row.name.trim().length > 0)
      .map((row) => ({
        name: row.name.trim(),
        description: row.description.trim() || undefined,
        maxPoints: Math.min(50, Math.max(1, row.maxPoints || 1)),
      }));

    if (criteria.length === 0) {
      return null;
    }

    return {
      name: customRubricName.trim() || undefined,
      criteria,
    };
  }, [customRows, customRubricName]);

  const customRubric = customRubricEnabled ? draftCustomRubric : null;

  const words = countWords(essayText);
  const minWords = status?.limits.minWords ?? 40;
  const maxWords = status?.limits.maxWords ?? 2000;
  const tooShort = words > 0 && words < minWords;
  const tooLong = words > maxWords;
  const selectedRubricMissing = !customRubricEnabled && !selectedRubric;
  const customRubricMissing = customRubricEnabled && !customRubric;
  const canContinueFromRubric = customRubricEnabled ? !customRubricMissing : !selectedRubricMissing;
  const canContinueFromSubmission = words >= minWords && !tooLong && !extracting;
  const submitBlocked =
    grading ||
    extracting ||
    words < minWords ||
    tooLong ||
    selectedRubricMissing ||
    customRubricMissing;

  const clearErrors = () => {
    setError(null);
    setFieldErrors({});
  };

  const readEssayFile = async (file: File) => {
    setExtracting(true);
    clearErrors();
    try {
      const document = await extractDocument(file);
      setEssayText(document.text);
      setEssayFileName(document.filename);
      if (!title.trim()) {
        setTitle(document.filename.replace(/\.[^.]+$/, ''));
      }
    } catch (cause) {
      setError(
        cause instanceof EssayGraderApiError && cause.status !== 0
          ? cause.message
          : localize('com_essay_grader_file_error'),
      );
    } finally {
      setExtracting(false);
    }
  };

  const handleEssayFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      void readEssayFile(file);
    }
  };

  const handleRubricFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setRubricFileName(file.name);
    setCustomRubricEnabled(true);
    clearErrors();
  };

  const addCustomCriterion = () => {
    setCustomRows((current) => [...current, newCriterionRow(nextRowKey)]);
    setNextRowKey((current) => current + 1);
  };

  const patchCustomCriterion = (key: number, next: Partial<CustomCriterionRow>) => {
    setCustomRows((current) => current.map((row) => (row.key === key ? { ...row, ...next } : row)));
  };

  const removeCustomCriterion = (key: number) => {
    setCustomRows((current) => current.filter((row) => row.key !== key));
  };

  const runGrading = async (event: React.FormEvent) => {
    event.preventDefault();
    setGrading(true);
    clearErrors();

    try {
      const response = await submitForGrading({
        text: essayText,
        mode: 'SCORE',
        rubricId: customRubric ? undefined : selectedRubric?.id,
        customRubric: customRubric ?? undefined,
        title: title.trim() || undefined,
        instructions: instructions.trim() || undefined,
      });
      setResult(response);
      setStatus((current) => (current ? { ...current, quota: response.quota } : current));
    } catch (cause) {
      if (cause instanceof EssayGraderApiError) {
        setError(cause.message);
        setFieldErrors(cause.fieldErrors ?? {});
      } else {
        setError(localize('com_essay_grader_grading_error'));
      }
    } finally {
      setGrading(false);
    }
  };

  if (result) {
    return (
      <EssayGraderShell>
        <ResultView
          response={result}
          rubrics={rubrics}
          onResult={setResult}
          onBack={() => {
            setResult(null);
            window.scrollTo({ top: 0 });
          }}
        />
      </EssayGraderShell>
    );
  }

  return (
    <EssayGraderShell>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 md:px-8 xl:px-10">
        <header className="bg-surface-primary/80 dark:bg-surface-primary/40 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border-light p-5 shadow-sm backdrop-blur dark:border-white/10">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate('/agents')}
              className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {localize('com_essay_grader_back_to_toolkit')}
            </button>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-sm">
                <BookOpenCheck className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-text-primary">
                  {localize('com_essay_grader_main_heading')}
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
                  {localize('com_essay_grader_subtitle')}
                </p>
              </div>
            </div>
          </div>
        </header>

        {serviceError ? <Alert tone="danger">{serviceError}</Alert> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <StepProgress
          activeStep={activeStep}
          steps={[
            localize('com_essay_grader_step_rubric_title'),
            localize('com_essay_grader_step_submission_title'),
            localize('com_essay_grader_step_run_title'),
          ]}
        />

        <form onSubmit={runGrading} className="mx-auto w-full max-w-6xl">
          <section className="bg-surface-primary/85 dark:bg-surface-primary/45 rounded-2xl border border-border-light shadow-sm backdrop-blur dark:border-white/10">
            <div className="border-b border-border-light px-5 py-5 dark:border-white/10 md:px-6">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
                <StepBadge number={activeStep} />
                {activeStep === 1 ? localize('com_essay_grader_step_rubric_title') : null}
                {activeStep === 2 ? localize('com_essay_grader_step_submission_title') : null}
                {activeStep === 3 ? localize('com_essay_grader_step_run_title') : null}
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                {activeStep === 1 ? localize('com_essay_grader_step_rubric_description') : null}
                {activeStep === 2 ? localize('com_essay_grader_step_submission_description') : null}
                {activeStep === 3 ? localize('com_essay_grader_step_run_description') : null}
              </p>
            </div>

            <div className="px-5 py-5 md:px-6">
              {activeStep === 1 ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <RubricScopeToggle
                      active={rubricJurisdiction === 'general'}
                      onClick={() => setRubricJurisdiction('general')}
                    >
                      General rubrics
                    </RubricScopeToggle>
                    <RubricScopeToggle
                      active={rubricJurisdiction !== 'general'}
                      onClick={() => setRubricJurisdiction((current) => (current === 'general' ? US_STATES[0].code : current))}
                    >
                      By state
                    </RubricScopeToggle>
                    {rubricJurisdiction !== 'general' ? (
                      <ControlCombobox
                        selectedValue={rubricJurisdiction}
                        displayValue={US_STATES.find((state) => state.code === rubricJurisdiction)?.name ?? 'Select a state'}
                        setValue={(value) => setRubricJurisdiction(value)}
                        items={US_STATES.map((state) => ({ label: state.name, value: state.code }))}
                        ariaLabel="State"
                        searchPlaceholder="Search states"
                        selectPlaceholder="Select a state"
                        isCollapsed={false}
                        showCarat={true}
                        popoverPortal={true}
                        containerClassName="w-48 px-0"
                        className="h-9 rounded-lg border-border-light bg-surface-primary text-xs font-semibold text-text-primary focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-400/20 dark:border-white/10"
                      />
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="block">
                      <span className="mb-2 block text-sm font-semibold text-text-primary">
                        {localize('com_essay_grader_choose_rubric')}
                      </span>
                      <ControlCombobox
                        selectedValue={customRubricEnabled ? '' : selectedRubricId}
                        displayValue={
                          customRubricEnabled
                            ? localize('com_essay_grader_custom_rubric_selected')
                            : (selectedRubric?.name ?? localize('com_essay_grader_select_rubric'))
                        }
                        setValue={(value) => {
                          setCustomRubricEnabled(false);
                          setSelectedRubricId(value);
                          clearErrors();
                        }}
                        items={rubrics.map((rubric) => ({ label: rubric.name, value: rubric.id }))}
                        ariaLabel={localize('com_essay_grader_choose_rubric')}
                        searchPlaceholder={localize('com_essay_grader_select_rubric')}
                        selectPlaceholder={localize('com_essay_grader_select_rubric')}
                        isCollapsed={false}
                        showCarat={true}
                        popoverPortal={false}
                        disabled={loadingRubrics || rubrics.length === 0}
                        containerClassName="px-0"
                        className="h-12 rounded-xl border-border-light bg-surface-primary text-text-primary focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-400/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10"
                      />
                      {rubricJurisdiction !== 'general' && !loadingRubrics && rubrics.length === 0 ? (
                        <p className="mt-2 text-xs text-text-tertiary">
                          No rubrics have been published for{' '}
                          {US_STATES.find((state) => state.code === rubricJurisdiction)?.name} yet.
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomRubricModalOpen(true);
                        clearErrors();
                      }}
                      className="inline-flex h-12 items-center justify-center gap-2 self-end rounded-xl border border-border-light px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-secondary dark:border-white/10"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {localize('com_essay_grader_use_custom')}
                    </button>
                  </div>

                  {customRubricEnabled ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-400/40 bg-blue-500/10 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">
                          {customRubric?.name || localize('com_essay_grader_custom_rubric')}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {rubricFileName ?? localize('com_essay_grader_custom_rubric_hint')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsCustomRubricModalOpen(true)}
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-500 transition-colors hover:bg-blue-500/10"
                      >
                        {localize('com_essay_grader_edit')}
                      </button>
                    </div>
                  ) : null}

                  <input
                    ref={rubricFileInputRef}
                    type="file"
                    accept=".csv,.json,.docx,.pdf,.txt,.md,.rtf"
                    onChange={handleRubricFileChange}
                    className="sr-only"
                    tabIndex={-1}
                  />
                  {fieldErrors.rubricId || fieldErrors.customRubric ? (
                    <p className="mt-3 text-sm text-red-500">
                      {fieldErrors.rubricId ?? fieldErrors.customRubric}
                    </p>
                  ) : null}
                </>
              ) : null}

              {activeStep === 2 ? (
                <div className="space-y-5">
                  <div className="bg-surface-secondary/45 rounded-2xl p-4 dark:bg-white/5">
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-text-primary">
                        {localize('com_essay_grader_assignment')}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-text-secondary">
                        {localize('com_essay_grader_optional_context_hint')}
                      </p>
                    </div>
                    <div className="grid gap-4">
                      <Field label={localize('com_essay_grader_assignment_title')}>
                        <input
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          className={inputClassName}
                          placeholder={localize('com_essay_grader_assignment_title_placeholder')}
                        />
                      </Field>
                      <Field label={localize('com_essay_grader_assignment_prompt')}>
                        <textarea
                          value={instructions}
                          onChange={(event) => setInstructions(event.target.value)}
                          rows={4}
                          className={cn(
                            inputClassName,
                            'h-auto min-h-[120px] resize-y py-3 leading-6',
                          )}
                          placeholder={localize('com_essay_grader_assignment_prompt_placeholder')}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="bg-surface-secondary/45 rounded-2xl p-4 dark:bg-white/5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">
                          {localize('com_essay_grader_submission')}
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {essayFileName ?? localize('com_essay_grader_submission_hint')}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {essayFileName ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEssayFileName(null);
                              setEssayText('');
                            }}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border-light px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-primary dark:border-white/10"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                            {localize('com_essay_grader_remove_file')}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => essayFileInputRef.current?.click()}
                          disabled={extracting || grading}
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border-light px-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10"
                        >
                          {extracting ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Upload className="h-4 w-4" aria-hidden="true" />
                          )}
                          {extracting
                            ? localize('com_essay_grader_reading_file')
                            : localize('com_essay_grader_upload_submission')}
                        </button>
                      </div>
                      <input
                        ref={essayFileInputRef}
                        type="file"
                        accept=".docx,.pdf,.txt,.md,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/rtf,text/rtf"
                        onChange={handleEssayFileChange}
                        className="sr-only"
                        tabIndex={-1}
                      />
                    </div>

                    <textarea
                      value={essayText}
                      onChange={(event) => {
                        setEssayText(event.target.value);
                        clearErrors();
                      }}
                      spellCheck={false}
                      rows={12}
                      placeholder={localize('com_essay_grader_submission_placeholder')}
                      className="mt-4 min-h-[280px] w-full resize-y rounded-2xl border border-border-light bg-surface-primary px-4 py-4 text-sm leading-7 text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-white/10"
                    />

                    <div className="mt-4 text-sm text-text-secondary">
                      <span
                        className={cn(tooShort || tooLong ? 'font-semibold text-amber-500' : '')}
                      >
                        {numberFormatter.format(words)} {localize('com_essay_grader_words')}
                      </span>
                      <span className="mx-2 text-text-tertiary">-</span>
                      <span>
                        {numberFormatter.format(essayText.length)}{' '}
                        {localize('com_essay_grader_characters')}
                      </span>
                      {tooShort ? (
                        <span className="ml-2 text-amber-500">
                          {localize('com_essay_grader_min_words', { count: minWords })}
                        </span>
                      ) : null}
                      {tooLong ? (
                        <span className="ml-2 text-red-500">
                          {localize('com_essay_grader_max_words', { count: maxWords })}
                        </span>
                      ) : null}
                    </div>
                    {fieldErrors.text ? (
                      <p className="mt-3 text-sm text-red-500">{fieldErrors.text}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {activeStep === 3 ? (
                <div className="space-y-3">
                  <ReviewRow
                    label={localize('com_essay_grader_assignment_title')}
                    value={title.trim() || localize('com_essay_grader_untitled')}
                    onEdit={() => setActiveStep(2)}
                  />
                  {instructions.trim() ? (
                    <ReviewRow
                      label={localize('com_essay_grader_assignment_prompt')}
                      value={instructions.trim()}
                      onEdit={() => setActiveStep(2)}
                    />
                  ) : null}
                  <ReviewRow
                    label={localize('com_essay_grader_rubric')}
                    value={
                      customRubric
                        ? customRubric.name || localize('com_essay_grader_custom_rubric')
                        : selectedRubric?.name || localize('com_essay_grader_choose_rubric')
                    }
                    onEdit={() => setActiveStep(1)}
                  />
                  <ReviewRow
                    label={localize('com_essay_grader_submission')}
                    value={`${numberFormatter.format(words)} ${localize('com_essay_grader_words')}`}
                    onEdit={() => setActiveStep(2)}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-light px-5 py-4 dark:border-white/10 md:px-6">
              <button
                type="button"
                onClick={() =>
                  setActiveStep((current) =>
                    current > 1 ? ((current - 1) as EssayGraderStep) : current,
                  )
                }
                disabled={activeStep === 1 || grading}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border-light px-5 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10"
              >
                {localize('com_essay_grader_back')}
              </button>

              {activeStep === 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  disabled={!canContinueFromRubric || loadingRubrics}
                  className="inline-flex h-11 min-w-[140px] items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {localize('com_essay_grader_next')}
                </button>
              ) : null}

              {activeStep === 2 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  disabled={!canContinueFromSubmission}
                  className="inline-flex h-11 min-w-[140px] items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {localize('com_essay_grader_next')}
                </button>
              ) : null}

              {activeStep === 3 ? (
                <button
                  type="submit"
                  disabled={submitBlocked}
                  className="inline-flex h-11 min-w-[160px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {grading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  )}
                  {grading
                    ? localize('com_essay_grader_grading')
                    : localize('com_essay_grader_run_grading')}
                </button>
              ) : null}
            </div>
          </section>
        </form>
        {isCustomRubricModalOpen ? (
          <CustomRubricModal
            customRubric={draftCustomRubric}
            name={customRubricName}
            rows={customRows}
            rubricFileName={rubricFileName}
            onNameChange={setCustomRubricName}
            onPatchRow={patchCustomCriterion}
            onRemoveRow={removeCustomCriterion}
            onAddRow={addCustomCriterion}
            onUpload={() => rubricFileInputRef.current?.click()}
            onRemoveFile={() => setRubricFileName(null)}
            onClose={() => setIsCustomRubricModalOpen(false)}
            onUseCustom={() => {
              setCustomRubricEnabled(true);
              setIsCustomRubricModalOpen(false);
              clearErrors();
            }}
          />
        ) : null}
      </div>
    </EssayGraderShell>
  );
};

const EssayGraderShell = ({ children }: { children: React.ReactNode }) => (
  <div className="relative flex h-full w-full grow overflow-auto bg-surface-primary">
    <ChatBackgroundLights mode="marketplace" />
    <div className="relative z-[1] min-h-full w-full">{children}</div>
  </div>
);

const RubricScopeToggle = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
      active
        ? 'bg-blue-600 text-white'
        : 'border border-border-light text-text-secondary hover:bg-surface-secondary dark:border-white/10',
    )}
  >
    {children}
  </button>
);

const Alert = ({ children, tone }: { children: React.ReactNode; tone: 'danger' | 'neutral' }) => (
  <div
    role={tone === 'danger' ? 'alert' : 'status'}
    className={cn(
      'rounded-xl border px-4 py-3 text-sm',
      tone === 'danger'
        ? 'border-red-400/30 bg-red-500/10 text-red-500'
        : 'border-border-light bg-surface-secondary text-text-secondary dark:border-white/10',
    )}
  >
    {children}
  </div>
);

const inputClassName =
  'h-11 w-full rounded-xl border border-border-light bg-surface-primary px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-white/10';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="block text-sm font-semibold text-text-primary">{label}</span>
    <span className="mt-2 block">{children}</span>
  </label>
);

const StepBadge = ({ number }: { number: number }) => {
  const localize = useLocalize();

  return (
    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-blue-600 px-2 text-xs font-bold text-white">
      <span className="sr-only">{localize('com_essay_grader_step_label', { count: number })}</span>
      {number}
    </span>
  );
};

const StepProgress = ({ activeStep, steps }: { activeStep: EssayGraderStep; steps: string[] }) => (
  <ol className="mx-auto grid w-full max-w-6xl grid-cols-3 gap-2">
    {steps.map((step, index) => {
      const stepNumber = (index + 1) as EssayGraderStep;
      const isActive = stepNumber === activeStep;
      const isDone = stepNumber < activeStep;

      return (
        <li
          key={step}
          className={cn(
            'rounded-xl border px-3 py-3 text-center text-xs font-semibold transition-colors md:text-sm',
            isActive || isDone
              ? 'border-blue-400 bg-blue-500/10 text-blue-600 dark:text-blue-200'
              : 'bg-surface-primary/70 border-border-light text-text-secondary dark:border-white/10',
          )}
        >
          <span className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface-secondary text-xs text-text-primary">
            {stepNumber}
          </span>
          {step}
        </li>
      );
    })}
  </ol>
);

const ReviewRow = ({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) => {
  const localize = useLocalize();

  return (
    <div className="bg-surface-secondary/55 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-light px-4 py-3 dark:border-white/10">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold leading-6 text-text-primary">
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-500 transition-colors hover:bg-blue-500/10"
      >
        {localize('com_essay_grader_edit')}
      </button>
    </div>
  );
};

const CustomRubricModal = ({
  customRubric,
  name,
  rows,
  rubricFileName,
  onNameChange,
  onPatchRow,
  onRemoveRow,
  onAddRow,
  onUpload,
  onRemoveFile,
  onClose,
  onUseCustom,
}: {
  customRubric: CustomRubric | null;
  name: string;
  rows: CustomCriterionRow[];
  rubricFileName: string | null;
  onNameChange: (value: string) => void;
  onPatchRow: (key: number, next: Partial<CustomCriterionRow>) => void;
  onRemoveRow: (key: number) => void;
  onAddRow: () => void;
  onUpload: () => void;
  onRemoveFile: () => void;
  onClose: () => void;
  onUseCustom: () => void;
}) => {
  const localize = useLocalize();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="essay-grader-custom-rubric-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-border-light bg-surface-primary shadow-2xl dark:border-white/10">
        <div className="flex items-start justify-between gap-4 border-b border-border-light px-5 py-4 dark:border-white/10">
          <div>
            <h2
              id="essay-grader-custom-rubric-title"
              className="text-xl font-semibold text-text-primary"
            >
              {localize('com_essay_grader_custom_modal_title')}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {localize('com_essay_grader_custom_rubric_hint')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
            aria-label={localize('com_ui_close')}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-2">
          <CustomRubricPanel
            name={name}
            rows={rows}
            rubricFileName={rubricFileName}
            onNameChange={onNameChange}
            onPatchRow={onPatchRow}
            onRemoveRow={onRemoveRow}
            onAddRow={onAddRow}
            onUpload={onUpload}
            onRemoveFile={onRemoveFile}
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-light px-5 py-4 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-border-light px-4 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-secondary dark:border-white/10"
          >
            {localize('com_essay_grader_cancel')}
          </button>
          <button
            type="button"
            onClick={onUseCustom}
            disabled={!customRubric}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {localize('com_essay_grader_use_custom')}
          </button>
        </div>
      </div>
    </div>
  );
};

const CustomRubricPanel = ({
  name,
  rows,
  rubricFileName,
  onNameChange,
  onPatchRow,
  onRemoveRow,
  onAddRow,
  onUpload,
  onRemoveFile,
}: {
  name: string;
  rows: CustomCriterionRow[];
  rubricFileName: string | null;
  onNameChange: (value: string) => void;
  onPatchRow: (key: number, next: Partial<CustomCriterionRow>) => void;
  onRemoveRow: (key: number) => void;
  onAddRow: () => void;
  onUpload: () => void;
  onRemoveFile: () => void;
}) => {
  const localize = useLocalize();
  const totalPoints = rows.reduce(
    (sum, row) => sum + (Number.isFinite(row.maxPoints) ? row.maxPoints : 0),
    0,
  );

  return (
    <div className="bg-surface-secondary/50 mt-4 rounded-xl border border-border-light p-4 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {localize('com_essay_grader_custom_builder')}
        </h3>
        <span className="text-xs text-text-secondary">
          {totalPoints} {localize('com_essay_grader_points')}
        </span>
      </div>

      <input
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        className={cn(inputClassName, 'mt-3')}
        placeholder={localize('com_essay_grader_custom_name_placeholder')}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onUpload}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-light px-3 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-primary dark:border-white/10"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {localize('com_essay_grader_upload_rubric')}
        </button>
        {rubricFileName ? (
          <button
            type="button"
            onClick={onRemoveFile}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-light px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-primary dark:border-white/10"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {localize('com_essay_grader_remove_rubric')}
          </button>
        ) : null}
      </div>
      {rubricFileName ? <p className="mt-2 text-xs text-text-secondary">{rubricFileName}</p> : null}

      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div
            key={row.key}
            className="rounded-xl border border-border-light bg-surface-primary p-3 dark:border-white/10"
          >
            <div className="flex gap-2">
              <input
                value={row.name}
                onChange={(event) => onPatchRow(row.key, { name: event.target.value })}
                className={cn(inputClassName, 'h-10 flex-1 font-semibold')}
                placeholder={localize('com_essay_grader_criterion_placeholder', {
                  count: index + 1,
                })}
                aria-label={localize('com_essay_grader_criterion_label', {
                  count: index + 1,
                })}
              />
              <input
                type="number"
                min={1}
                max={50}
                value={Number.isFinite(row.maxPoints) ? row.maxPoints : ''}
                onChange={(event) =>
                  onPatchRow(row.key, { maxPoints: Number.parseInt(event.target.value, 10) || 1 })
                }
                className={cn(inputClassName, 'h-10 w-20 text-center tabular-nums')}
                aria-label={localize('com_essay_grader_points_label', { count: index + 1 })}
              />
              <button
                type="button"
                onClick={() => onRemoveRow(row.key)}
                disabled={rows.length === 1}
                aria-label={localize('com_essay_grader_remove_criterion', { count: index + 1 })}
                className="rounded-lg px-2 text-text-tertiary transition-colors hover:bg-surface-secondary hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <input
              value={row.description}
              onChange={(event) => onPatchRow(row.key, { description: event.target.value })}
              className={cn(inputClassName, 'mt-2 h-10 text-xs')}
              placeholder={localize('com_essay_grader_criterion_description')}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAddRow}
        className="mt-3 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-500 transition-colors hover:bg-blue-500/10"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {localize('com_essay_grader_add_criterion')}
      </button>
    </div>
  );
};

type DocumentView = 'view' | 'text' | 'original';
type ResultMetricView = 'comments' | 'grammar' | 'rubric' | 'evidence';
type SettingsPanel = 'rubric' | 'mode' | 'parameters' | 'rules' | null;

/** Shape shared by every lucide-react icon used as a prop in this file's
 *  result-screen components (they all accept at least these two). */
type ResultIcon = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

/**
 * The graded output as a working result screen.
 *
 * Ported from the standalone Co-grader app's `ResultView.tsx` /
 * `GraderTool.tsx` — same three-pane structure (document / feedback /
 * customization), same mode-switching and grammar-check behavior — restyled
 * to Ethos Educate's own tokens and kept inside the normal page flow (not a
 * full-bleed overlay) so it never touches the viewport edges.
 */
const ResultView = ({
  response,
  rubrics,
  onBack,
  onResult,
}: {
  response: GradingResponse;
  /** The general rubric set already loaded for step 1 — reused here for "Change rubric". */
  rubrics: RubricSummary[];
  onBack: () => void;
  onResult: (next: GradingResponse) => void;
}) => {
  const localize = useLocalize();
  const [documentView, setDocumentView] = useState<DocumentView>('text');
  const [metricView, setMetricView] = useState<ResultMetricView>('comments');
  const [panelTab, setPanelTab] = useState<'feedback' | 'customize'>('feedback');
  const [activeCriterionId, setActiveCriterionId] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>(null);
  const [scoreEditorId, setScoreEditorId] = useState<string | null>(null);
  const [instructionDraft, setInstructionDraft] = useState('');
  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedCriterionId, setCopiedCriterionId] = useState<string | null>(null);

  const { result } = response;
  const title = response.title?.trim() || localize('com_essay_grader_untitled');
  const scoreSummary = result.total
    ? `${result.total.points}/${result.total.maxPoints} pts · ${result.total.percentage}%`
    : MODE_SUMMARY_LABEL[result.mode];

  useEffect(() => {
    setActiveCriterionId(null);
    setScoreEditorId(null);
    setActionError(null);
    setCopiedCriterionId(null);
    setPanelTab('feedback');
    if (response.mode === 'PROOFREAD') setMetricView('grammar');
  }, [response.id, response.mode]);

  const allHighlights = useMemo<TextHighlight[]>(
    () => [
      ...result.criteria.flatMap((criterion) =>
        criterion.evidence.map((span) => ({
          start: span.start,
          end: span.end,
          polarity: span.polarity,
          groupId: criterion.criterionId,
          label: `${criterion.name}: ${span.note}`,
        })),
      ),
      ...result.generalEvidence.map((span) => ({
        start: span.start,
        end: span.end,
        polarity: span.polarity,
        groupId: 'general',
        label: span.note,
      })),
    ],
    [result.criteria, result.generalEvidence],
  );

  const grammarCriteria = useMemo(
    () => result.criteria.filter((criterion) => isGrammarCriterion(criterion)),
    [result.criteria],
  );
  const grammarCriterionIds = useMemo(
    () => new Set(grammarCriteria.map((criterion) => criterion.criterionId)),
    [grammarCriteria],
  );
  /** Whether an actual proofread pass exists for this submission — the
   *  only thing that should ever gate or populate the Grammar tab. */
  const proofreadAvailable = result.mode === 'PROOFREAD' || response.availableModes.includes('PROOFREAD');

  const filteredHighlights = useMemo(() => {
    if (documentView === 'original') return [];
    if (metricView === 'grammar') {
      return allHighlights.filter(
        (highlight) => highlight.groupId !== null && grammarCriterionIds.has(highlight.groupId),
      );
    }
    if (metricView === 'rubric') {
      return allHighlights.filter((highlight) => highlight.groupId !== 'general');
    }
    return allHighlights;
  }, [allHighlights, documentView, grammarCriterionIds, metricView]);

  const commentCount = result.criteria.length || result.generalEvidence.length || result.nextSteps.length;
  const combinedInstructions = buildInstructions(instructionDraft, selectedRules);
  const canRerunWithCurrentRubric = !modeNeedsRubric(result.mode) || result.rubric !== null;

  function chooseMetric(next: ResultMetricView) {
    if (next === 'grammar' && result.mode !== 'PROOFREAD') {
      // Grammar only ever reflects a real proofread pass. If one hasn't
      // been run yet the tab is disabled and this is unreachable; if one
      // is cached, switch into it (free — it's already in availableModes)
      // instead of guessing at a score from an unrelated criterion.
      if (!proofreadAvailable) return;
      void switchMode('PROOFREAD');
      return;
    }
    setMetricView(next);
    setActiveCriterionId(null);
  }

  function updateCriterionPoints(criterionId: string, nextPoints: number) {
    const nextCriteria = result.criteria.map((criterion) =>
      criterion.criterionId === criterionId
        ? {
            ...criterion,
            judged: true,
            points: clampNumber(Math.round(nextPoints), 0, criterion.maxPoints),
            levelLabel: criterion.levelLabel ?? 'Teacher adjusted',
          }
        : criterion,
    );

    onResult({
      ...response,
      result: { ...result, criteria: nextCriteria, total: calculateTotal(nextCriteria) },
    });
  }

  async function copyCriterion(criterion: CriterionResult) {
    const score =
      criterion.points === null
        ? criterion.judged === false
          ? 'Not marked'
          : 'No score'
        : `${criterion.points}/${criterion.maxPoints}`;

    await copyPlainText(`${criterion.name} - ${score}\n${criterion.rationale}`);
    setCopiedCriterionId(criterion.criterionId);
    window.setTimeout(() => setCopiedCriterionId(null), 1600);
  }

  async function switchMode(mode: GradingMode) {
    if (mode === response.mode || pendingAction) return;
    if (modeNeedsRubric(mode) && !result.rubric) {
      setActionError('Choose a rubric before switching to a scored or comment-only pass.');
      setSettingsPanel('rubric');
      return;
    }

    setPendingAction(`mode:${mode}`);
    setActionError(null);
    try {
      const next =
        combinedInstructions.length > 0
          ? await submitForGrading({
              text: response.text,
              mode,
              rubricId: modeNeedsRubric(mode) ? (result.rubric?.id ?? undefined) : undefined,
              title: response.title?.trim() || undefined,
              instructions: encodeGraderDirections(combinedInstructions),
            })
          : await runGradingMode(response.id, mode);
      onResult(next);
      setSettingsPanel(null);
    } catch (cause) {
      setActionError(readError(cause, 'Could not switch modes. Please try again.'));
    } finally {
      setPendingAction(null);
    }
  }

  async function changeRubric(rubric: RubricSummary) {
    await rerunGrader({
      mode: modeNeedsRubric(result.mode) ? result.mode : 'SCORE',
      label: 'rubric',
      rubricId: rubric.id,
      instructions: combinedInstructions,
    });
    setSettingsPanel(null);
  }

  async function applyInstructions() {
    if (!combinedInstructions) {
      setActionError('Add an instruction or select an advanced rule before rerunning.');
      return;
    }
    if (!canRerunWithCurrentRubric) {
      setActionError('Choose a rubric before rerunning this result with instructions.');
      setSettingsPanel('rubric');
      return;
    }

    await rerunGrader({
      mode: result.mode,
      label: 'instructions',
      rubricId: modeNeedsRubric(result.mode) ? (result.rubric?.id ?? undefined) : undefined,
      instructions: combinedInstructions,
    });
  }

  async function rerunGrader({
    mode,
    label,
    rubricId,
    instructions,
  }: {
    mode: GradingMode;
    label: string;
    rubricId?: string;
    instructions?: string;
  }) {
    setPendingAction(label);
    setActionError(null);
    try {
      const next = await submitForGrading({
        text: response.text,
        mode,
        rubricId: modeNeedsRubric(mode) ? rubricId : undefined,
        title: response.title?.trim() || undefined,
        instructions: encodeGraderDirections(instructions),
      });
      onResult(next);
    } catch (cause) {
      setActionError(readError(cause, 'Could not rerun the grader. Please try again.'));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-5 px-5 py-6 md:px-8 xl:px-12">
      {copyOpen && <CopyFeedbackDialog response={response} onClose={() => setCopyOpen(false)} />}

      {settingsPanel && (
        <SettingsSheet
          panel={settingsPanel}
          response={response}
          rubrics={rubrics}
          pendingAction={pendingAction}
          selectedRules={selectedRules}
          onClose={() => setSettingsPanel(null)}
          onSwitchMode={(mode) => void switchMode(mode)}
          onChangeRubric={(rubric) => void changeRubric(rubric)}
          onToggleRule={(id) =>
            setSelectedRules((current) =>
              current.includes(id) ? current.filter((ruleId) => ruleId !== id) : [...current, id],
            )
          }
        />
      )}

      <header className="overflow-hidden rounded-2xl border border-border-light shadow-sm dark:border-white/10 xl:sticky xl:top-4 xl:z-10">
        <div className="bg-surface-primary/85 dark:bg-surface-primary/45 flex flex-wrap items-center gap-4 border-b border-border-light px-4 py-3 backdrop-blur dark:border-white/10 sm:px-5">
          <button
            type="button"
            onClick={onBack}
            aria-label={localize('com_essay_grader_grade_another')}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
              {localize('com_essay_grader_result')}
            </p>
            <h1 className="truncate text-lg font-bold tracking-tight text-text-primary">{title}</h1>
          </div>
          <div className="hidden shrink-0 sm:block">
            <span className="inline-flex items-center gap-2 rounded-lg border border-border-light bg-surface-secondary px-3 py-1.5 dark:border-white/10">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                {result.mode === 'SCORE' ? 'Score' : 'Result'}
              </span>
              <span className="text-sm font-bold text-text-primary">{scoreSummary}</span>
            </span>
          </div>
        </div>

        <div className="bg-surface-primary/85 dark:bg-surface-primary/45 flex flex-wrap items-center justify-between gap-3 p-3 backdrop-blur">
          <div className="order-3 w-full lg:order-none lg:w-auto lg:min-w-[20rem] lg:flex-1 xl:max-w-xl">
            <ModeTabs response={response} onResult={onResult} />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCopyOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-light px-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-secondary dark:border-white/10"
            >
              <CopyIcon className="h-4 w-4" aria-hidden="true" />
              {localize('com_essay_grader_result_copy')}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              {localize('com_essay_grader_grade_another')}
            </button>
          </div>
        </div>
      </header>

      {actionError && !settingsPanel && (
        <Alert tone="danger">{actionError}</Alert>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(26rem,60%)_minmax(22rem,1fr)] xl:items-start">
        <DocumentPane
          title={title}
          response={response}
          commentCount={commentCount}
          highlights={filteredHighlights}
          activeCriterionId={activeCriterionId}
          documentView={documentView}
          metricView={metricView}
          onDocumentViewChange={setDocumentView}
          onMetricViewChange={chooseMetric}
        />

        <WorkspacePanel
          panelTab={panelTab}
          onPanelTabChange={setPanelTab}
          feedbackProps={{
            result,
            activeCriterionId,
            metricView,
            copiedCriterionId,
            scoreEditorId,
            onToggleCriterion: (id) => setActiveCriterionId((current) => (current === id ? null : id)),
            onScoreEditorChange: (id) => setScoreEditorId((current) => (current === id ? null : id)),
            onScoreChange: updateCriterionPoints,
            onCopyCriterion: (criterion) => void copyCriterion(criterion),
          }}
          customizationProps={{
            response,
            settingsPanel,
            instructionDraft,
            selectedRules,
            pendingAction,
            actionError,
            onSettingsPanelChange: (panel) =>
              setSettingsPanel((current) => (current === panel ? null : panel)),
            onInstructionDraftChange: setInstructionDraft,
            onAddPreset: (instruction) =>
              setInstructionDraft((current) => appendInstruction(current, instruction)),
            onClearInstructions: () => {
              setInstructionDraft('');
              setSelectedRules([]);
              setActionError(null);
            },
            onApplyInstructions: () => void applyInstructions(),
            onRunProofread: () => void switchMode('PROOFREAD'),
          }}
        />
      </div>
    </div>
  );
};

/**
 * The Feedback and Customization panes as one tabbed card instead of two
 * separate columns. Ported from the same change in the standalone Co-grader
 * app — cuts the workspace from three equal-width panels to two (Document,
 * now the dominant pane, plus this one) so Document isn't boxed into the
 * narrowest slot and the screen doesn't read as three generic side-by-side
 * tiles.
 */
const WorkspacePanel = ({
  panelTab,
  onPanelTabChange,
  feedbackProps,
  customizationProps,
}: {
  panelTab: 'feedback' | 'customize';
  onPanelTabChange: (tab: 'feedback' | 'customize') => void;
  feedbackProps: Parameters<typeof FeedbackPane>[0];
  customizationProps: Parameters<typeof CustomizationPane>[0];
}) => (
  <section className="bg-surface-primary/80 dark:bg-surface-primary/40 flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-border-light shadow-sm dark:border-white/10 xl:sticky xl:top-[8.5rem] xl:max-h-[calc(100vh-11rem)]">
    <div role="tablist" aria-label="Workspace panel" className="flex shrink-0 border-b border-border-light px-4 dark:border-white/10 sm:px-5">
      <button
        type="button"
        role="tab"
        aria-selected={panelTab === 'feedback'}
        onClick={() => onPanelTabChange('feedback')}
        className={cn(
          'relative px-1 py-3 text-sm font-bold transition-colors',
          panelTab === 'feedback'
            ? 'text-text-primary after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-blue-500'
            : 'text-text-tertiary hover:text-text-primary',
        )}
      >
        Feedback
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={panelTab === 'customize'}
        onClick={() => onPanelTabChange('customize')}
        className={cn(
          'relative ml-5 px-1 py-3 text-sm font-bold transition-colors',
          panelTab === 'customize'
            ? 'text-text-primary after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-blue-500'
            : 'text-text-tertiary hover:text-text-primary',
        )}
      >
        Customize
      </button>
    </div>

    {panelTab === 'feedback' ? <FeedbackPane {...feedbackProps} /> : <CustomizationPane {...customizationProps} />}
  </section>
);

const DocumentPane = ({
  title,
  response,
  commentCount,
  highlights,
  activeCriterionId,
  documentView,
  metricView,
  onDocumentViewChange,
  onMetricViewChange,
}: {
  title: string;
  response: GradingResponse;
  commentCount: number;
  highlights: TextHighlight[];
  activeCriterionId: string | null;
  documentView: DocumentView;
  metricView: ResultMetricView;
  onDocumentViewChange: (view: DocumentView) => void;
  onMetricViewChange: (view: ResultMetricView) => void;
}) => {
  const localize = useLocalize();
  const grammarAvailable =
    response.result.mode === 'PROOFREAD' || response.availableModes.includes('PROOFREAD');

  return (
  <section className="bg-surface-primary/80 dark:bg-surface-primary/40 flex min-h-[26rem] flex-col overflow-hidden rounded-2xl border border-border-light shadow-sm dark:border-white/10 xl:sticky xl:top-[8.5rem] xl:max-h-[calc(100vh-11rem)]">
    <div className="border-b border-border-light px-4 py-3 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-sm font-bold text-text-primary">
          {title} <span className="font-semibold text-text-tertiary">({commentCount})</span>
        </h2>
        <SegmentedControl
          label="Document view"
          options={[
            { value: 'view', label: 'View' },
            { value: 'text', label: 'Text' },
            { value: 'original', label: 'Original' },
          ]}
          value={documentView}
          onChange={onDocumentViewChange}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border-light pt-2.5 text-sm dark:border-white/10">
        <MetricTab
          active={metricView === 'comments'}
          icon={MessageSquare}
          label={
            response.result.mode === 'PROOFREAD'
              ? localize('com_essay_grader_result_tab_issues')
              : localize('com_essay_grader_result_tab_comments')
          }
          value={
            response.result.mode === 'PROOFREAD'
              ? String(countProofreadIssues(response.result))
              : String(commentCount)
          }
          onClick={() => onMetricViewChange('comments')}
        />
        <MetricTab
          active={metricView === 'grammar'}
          icon={SpellCheck}
          label={localize('com_essay_grader_result_tab_grammar')}
          value={grammarScore(response.result)}
          disabled={!grammarAvailable}
          disabledHint="Run a grammar & spell check first to see results here."
          onClick={() => onMetricViewChange('grammar')}
        />
        <MetricTab
          active={metricView === 'rubric'}
          icon={BookOpenCheck}
          label={localize('com_essay_grader_result_tab_rubric')}
          value={rubricScore(response.result)}
          onClick={() => onMetricViewChange('rubric')}
        />
        <MetricTab
          active={metricView === 'evidence'}
          icon={Sparkles}
          label={localize('com_essay_grader_result_tab_evidence')}
          value={evidenceCountLabel(response.result)}
          onClick={() => onMetricViewChange('evidence')}
        />
      </div>
    </div>

    <div className="relative flex-1 overflow-y-auto px-4 py-3">
      {documentView === 'view' && <ReadableEssay title={response.title} text={response.text} />}

      {documentView === 'text' && (
        <HighlightedText
          text={response.text}
          highlights={highlights}
          activeGroupId={activeCriterionId}
          className="text-sm leading-7"
        />
      )}

      {documentView === 'original' && (
        <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-text-primary">
          {response.text}
        </pre>
      )}

      <div className="sticky bottom-0 mt-4 flex justify-end">
        <span className="rounded-lg border border-border-light bg-surface-primary px-3 py-1.5 text-xs font-bold text-blue-500 shadow-sm dark:border-white/10">
          {response.result.metrics.paragraphs} paragraphs · {response.wordCount.toLocaleString()} words
        </span>
      </div>
    </div>
  </section>
  );
};

const FeedbackPane = ({
  result,
  metricView,
  activeCriterionId,
  copiedCriterionId,
  scoreEditorId,
  onToggleCriterion,
  onScoreEditorChange,
  onScoreChange,
  onCopyCriterion,
}: {
  result: GradingResultDocument;
  metricView: ResultMetricView;
  activeCriterionId: string | null;
  copiedCriterionId: string | null;
  scoreEditorId: string | null;
  onToggleCriterion: (id: string) => void;
  onScoreEditorChange: (id: string) => void;
  onScoreChange: (id: string, points: number) => void;
  onCopyCriterion: (criterion: CriterionResult) => void;
}) => {
  const rows = buildRows(result);
  const visibleRows = filterRows(rows, metricView, result.mode);
  const paneTitle =
    result.mode === 'PROOFREAD'
      ? 'Grammar & spelling check'
      : metricView === 'evidence'
        ? 'Evidence'
        : metricView === 'grammar'
          ? 'Grammar'
          : result.rubric
            ? 'Rubric'
            : 'Feedback';
  const evidenceCount = countEvidence(result);

  return (
    <section className="bg-surface-primary/80 dark:bg-surface-primary/40 flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-border-light shadow-sm dark:border-white/10 xl:max-h-[calc(100vh-9rem)]">
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {result.overallComment && (
          <p className="text-sm leading-6 text-text-secondary">{result.overallComment}</p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-text-primary">{paneTitle}</h2>
          {result.mode === 'PROOFREAD' ? (
            <Badge>
              {countProofreadIssues(result)} issue{countProofreadIssues(result) === 1 ? '' : 's'} flagged
            </Badge>
          ) : metricView === 'evidence' ? (
            <Badge>
              {evidenceCount} cited span{evidenceCount === 1 ? '' : 's'}
            </Badge>
          ) : result.total ? (
            <Badge>
              {result.total.points}/{result.total.maxPoints} points · {result.total.percentage}%
            </Badge>
          ) : null}
        </div>

        {metricView === 'evidence' ? (
          <EvidenceList
            result={result}
            activeCriterionId={activeCriterionId}
            copiedCriterionId={copiedCriterionId}
            onToggleCriterion={onToggleCriterion}
            onCopyCriterion={onCopyCriterion}
          />
        ) : (
          <>
            <div className="mt-3 divide-y divide-border-light dark:divide-white/10">
              {visibleRows.map((criterion, index) => (
                <CriterionResultRow
                  key={criterion.criterionId}
                  criterion={criterion}
                  index={index}
                  mode={result.mode}
                  active={activeCriterionId === criterion.criterionId}
                  copied={copiedCriterionId === criterion.criterionId}
                  editingScore={scoreEditorId === criterion.criterionId}
                  onToggle={() => onToggleCriterion(criterion.criterionId)}
                  onEditScore={() => onScoreEditorChange(criterion.criterionId)}
                  onScoreChange={(points) => onScoreChange(criterion.criterionId, points)}
                  onCopy={() => onCopyCriterion(criterion)}
                />
              ))}
            </div>

            {visibleRows.length === 0 && (
              <p className="rounded-lg border border-border-light bg-surface-secondary px-4 py-5 text-sm text-text-secondary dark:border-white/10">
                {emptyMetricMessage(metricView, result.mode)}
              </p>
            )}
          </>
        )}

        {metricView !== 'evidence' && (result.strengths.length > 0 || result.nextSteps.length > 0) && (
          <div className="grid gap-4 border-t border-border-light py-5 dark:border-white/10 md:grid-cols-2">
            <SmallList title={result.strengths.length > 0 ? 'What is working' : ''} items={result.strengths} />
            <SmallList title={result.nextSteps.length > 0 ? 'What to do next' : ''} items={result.nextSteps} />
          </div>
        )}
      </div>
    </section>
  );
};

const EvidenceList = ({
  result,
  activeCriterionId,
  copiedCriterionId,
  onToggleCriterion,
  onCopyCriterion,
}: {
  result: GradingResultDocument;
  activeCriterionId: string | null;
  copiedCriterionId: string | null;
  onToggleCriterion: (id: string) => void;
  onCopyCriterion: (criterion: CriterionResult) => void;
}) => {
  const items = [
    ...result.criteria.flatMap((criterion) =>
      criterion.evidence.map((span, index) => ({
        id: `${criterion.criterionId}-${span.start}-${span.end}-${index}`,
        groupId: criterion.criterionId,
        criterion,
        criterionName: criterion.name,
        quote: span.quote,
        note: span.note,
        polarity: span.polarity,
        matchKind: span.matchKind,
      })),
    ),
    ...result.generalEvidence.map((span, index) => ({
      id: `general-${span.start}-${span.end}-${index}`,
      groupId: 'general',
      criterion: null as CriterionResult | null,
      criterionName: 'General feedback',
      quote: span.quote,
      note: span.note,
      polarity: span.polarity,
      matchKind: span.matchKind,
    })),
  ];

  if (items.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-border-light bg-surface-secondary px-4 py-5 text-sm text-text-secondary dark:border-white/10">
        No evidence spans were returned for this result. Rerun with stricter evidence instructions if
        every comment needs a quote.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {items.map((item) => {
        const active = activeCriterionId === item.groupId;
        const copied = item.criterion ? copiedCriterionId === item.criterion.criterionId : false;

        return (
          <article
            key={item.id}
            className={cn(
              'rounded-xl border bg-surface-primary p-3 shadow-sm transition-colors dark:bg-surface-primary/40',
              active ? 'border-blue-400 bg-blue-500/5' : 'border-border-light dark:border-white/10',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary">
                  {item.criterionName}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-text-primary">"{item.quote}"</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <IconButton
                  label={active ? `Hide evidence for ${item.criterionName}` : `Show evidence for ${item.criterionName}`}
                  active={active}
                  onClick={() => onToggleCriterion(item.groupId)}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                </IconButton>
                {item.criterion && (
                  <IconButton
                    label={`Copy comment for ${item.criterionName}`}
                    active={copied}
                    onClick={() => onCopyCriterion(item.criterion as CriterionResult)}
                  >
                    {copied ? <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> : <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                  </IconButton>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-md border px-2 py-1 text-xs font-bold',
                  item.polarity === 'STRENGTH'
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                    : 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
                )}
              >
                {item.polarity === 'STRENGTH' ? 'Strength' : 'Growth'}
              </span>
              <span className="rounded-md border border-border-light bg-surface-secondary px-2 py-1 text-xs font-semibold text-text-tertiary dark:border-white/10">
                {item.matchKind === 'EXACT' ? 'Exact quote' : 'Normalized match'}
              </span>
            </div>
            {item.note && (
              <p className="mt-3 rounded-lg bg-surface-secondary/75 px-3 py-2 text-xs leading-relaxed text-text-secondary">
                {item.note}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
};

const CriterionResultRow = ({
  criterion,
  index,
  mode,
  active,
  copied,
  editingScore,
  onToggle,
  onEditScore,
  onScoreChange,
  onCopy,
}: {
  criterion: CriterionResult;
  index: number;
  mode: GradingMode;
  active: boolean;
  copied: boolean;
  editingScore: boolean;
  onToggle: () => void;
  onEditScore: () => void;
  onScoreChange: (points: number) => void;
  onCopy: () => void;
}) => {
  const scored = criterion.points !== null && criterion.maxPoints > 0;

  return (
    <article
      className={cn(
        'group grid gap-4 py-4 transition-colors md:grid-cols-[minmax(0,1fr)_minmax(10rem,13rem)]',
        active && '-mx-2 rounded-xl bg-blue-500/5 px-2 ring-1 ring-blue-400/40',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={active}
            className="min-w-0 rounded-lg text-left"
          >
            <h3 className="text-sm font-bold text-text-primary">
              {index + 1}) {criterion.name}
            </h3>
          </button>

          <div className="flex shrink-0 items-center gap-1.5 opacity-100 transition-opacity md:opacity-70 md:group-hover:opacity-100">
            <IconButton
              label={active ? `Hide evidence for ${criterion.name}` : `Show evidence for ${criterion.name}`}
              active={active}
              onClick={onToggle}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            </IconButton>
            <IconButton label={`Copy comment for ${criterion.name}`} active={copied} onClick={onCopy}>
              {copied ? <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> : <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            </IconButton>
          </div>
        </div>

        <p className="mt-2 rounded-lg bg-surface-secondary/75 px-3 py-2.5 text-sm leading-relaxed text-text-primary">
          {criterion.rationale}
        </p>

        {active && criterion.evidence.length > 0 && (
          <ul className="mt-3 space-y-2 border-l-2 border-blue-400 pl-3">
            {criterion.evidence.map((span, evidenceIndex) => (
              <li
                key={`${span.start}-${span.end}-${evidenceIndex}`}
                className="rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-xs leading-relaxed text-text-secondary shadow-sm dark:border-white/10"
              >
                <span className="font-semibold text-text-primary">Evidence:</span> "{span.quote}"
                {span.note && <span> — {span.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ScoreControl
        criterion={criterion}
        mode={mode}
        scored={scored}
        editing={editingScore}
        onEdit={onEditScore}
        onScoreChange={onScoreChange}
      />
    </article>
  );
};

const ScoreControl = ({
  criterion,
  mode,
  scored,
  editing,
  onEdit,
  onScoreChange,
}: {
  criterion: CriterionResult;
  mode: GradingMode;
  scored: boolean;
  editing: boolean;
  onEdit: () => void;
  onScoreChange: (points: number) => void;
}) => {
  if (mode !== 'SCORE') {
    return (
      <div className="md:pt-6">
        <div className="rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-xs font-semibold text-text-secondary dark:border-white/10">
          {mode === 'PROOFREAD' ? 'Issue check' : 'Comment-only'}
        </div>
      </div>
    );
  }

  if (!scored && criterion.maxPoints > 0) {
    return (
      <div className="md:pt-6">
        <button
          type="button"
          onClick={() => onScoreChange(Math.max(1, criterion.maxPoints))}
          className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-left text-xs font-semibold text-text-secondary transition-colors hover:border-blue-400 hover:bg-blue-500/5 dark:border-white/10"
        >
          Add score
        </button>
      </div>
    );
  }

  if (!scored) {
    return (
      <div className="md:pt-6">
        <div className="rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-xs font-semibold text-text-secondary dark:border-white/10">
          {criterion.judged === false ? 'Not marked' : 'No score'}
        </div>
      </div>
    );
  }

  const value = criterion.points ?? 0;
  const ratio = criterion.maxPoints > 0 ? value / criterion.maxPoints : 0;
  const band = scoreBand(ratio);

  return (
    <div className="md:pt-6">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Adjust score for ${criterion.name}`}
        aria-expanded={editing}
        className={cn(
          'flex w-full items-stretch overflow-hidden rounded-lg border text-left transition-colors',
          editing ? 'border-blue-400' : 'border-border-light hover:border-blue-300 dark:border-white/10',
        )}
      >
        {/* A colour-coded rule rather than a filled progress bar — the score
            band (strong / developing / needs work) is the thing worth seeing
            at a glance, not a percentage-of-a-line-length metaphor every
            grading tool already uses. */}
        <span className={cn('w-1.5 shrink-0', SCORE_BAND_RULE_CLASS[band])} aria-hidden />
        <span className={cn('flex-1 px-3 py-2.5 transition-colors', editing ? 'bg-blue-500/5' : 'bg-surface-secondary')}>
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-bold text-text-primary">Score</span>
            <span className="text-lg font-bold leading-none tabular-nums text-text-primary">
              {value}
              <span className="text-xs font-semibold text-text-tertiary">/{criterion.maxPoints}</span>
            </span>
          </span>
          {criterion.levelLabel && (
            <span className="mt-1.5 block truncate text-right text-xs font-semibold text-text-tertiary">
              {criterion.levelLabel}
            </span>
          )}
        </span>
      </button>

      {editing && (
        <div className="mt-3 rounded-xl border border-blue-300 bg-surface-primary p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <IconButton
              label={`Decrease score for ${criterion.name}`}
              disabled={value <= 0}
              onClick={() => onScoreChange(value - 1)}
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </IconButton>
            <input
              type="range"
              min={0}
              max={criterion.maxPoints}
              step={1}
              value={value}
              aria-label={`Score for ${criterion.name}`}
              onChange={(event) => onScoreChange(Number(event.target.value))}
              className="h-3 min-w-0 flex-1 cursor-pointer accent-blue-600"
            />
            <IconButton
              label={`Increase score for ${criterion.name}`}
              disabled={value >= criterion.maxPoints}
              onClick={() => onScoreChange(value + 1)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </IconButton>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs tabular-nums text-text-tertiary">
            <span>0</span>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md px-2 py-1 font-bold text-blue-600 transition-colors hover:bg-blue-500/10"
            >
              Done
            </button>
            <span>{criterion.maxPoints} pts</span>
          </div>
        </div>
      )}
    </div>
  );
};

type ScoreBand = 'strong' | 'developing' | 'needsWork';

function scoreBand(ratio: number): ScoreBand {
  if (ratio >= 0.8) return 'strong';
  if (ratio >= 0.5) return 'developing';
  return 'needsWork';
}

/** Reuses the same emerald/amber/red already used for the Evidence tags and
 *  error states elsewhere in this file, rather than inventing a new palette. */
const SCORE_BAND_RULE_CLASS: Record<ScoreBand, string> = {
  strong: 'bg-emerald-500',
  developing: 'bg-amber-500',
  needsWork: 'bg-red-500',
};

const IconButton = ({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={cn(
      'grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-text-secondary transition-colors',
      active
        ? 'border-blue-400 bg-blue-500/10 text-blue-600'
        : 'border-border-light bg-surface-primary hover:border-blue-300 hover:bg-surface-secondary dark:border-white/10',
      disabled && 'cursor-not-allowed opacity-45',
    )}
  >
    {children}
  </button>
);

const Badge = ({ children }: { children: ReactNode }) => (
  <p className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-600">{children}</p>
);

const CustomizationPane = ({
  response,
  settingsPanel,
  instructionDraft,
  selectedRules,
  pendingAction,
  actionError,
  onSettingsPanelChange,
  onInstructionDraftChange,
  onAddPreset,
  onClearInstructions,
  onApplyInstructions,
  onRunProofread,
}: {
  response: GradingResponse;
  settingsPanel: SettingsPanel;
  instructionDraft: string;
  selectedRules: string[];
  pendingAction: string | null;
  actionError: string | null;
  onSettingsPanelChange: (panel: SettingsPanel) => void;
  onInstructionDraftChange: (value: string) => void;
  onAddPreset: (instruction: string) => void;
  onClearInstructions: () => void;
  onApplyInstructions: () => void;
  onRunProofread: () => void;
}) => {
  const localize = useLocalize();
  const { result } = response;
  const mode = TOOL_MODES.find((item) => item.mode === result.mode);
  const paragraphs = result.metrics.paragraphs;
  const instructionsReady = buildInstructions(instructionDraft, selectedRules).length > 0;
  const presets = result.mode === 'PROOFREAD' ? PROOFREAD_INSTRUCTION_PRESETS : GRADING_INSTRUCTION_PRESETS;
  const rulesValue =
    selectedRules.length > 0
      ? `${selectedRules.length} advanced rule${selectedRules.length === 1 ? '' : 's'} selected`
      : result.mode === 'PROOFREAD'
        ? 'Exact corrections, preserve meaning'
        : mode?.needsRubric
          ? 'Rubric evidence, verified quotes'
          : 'Revision priorities';

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4">
      <div className="space-y-4">
        {(result.rubric || modeNeedsRubric(result.mode)) && (
          <SettingGroup
            title="Rubric"
            value={result.rubric?.name ?? localize('com_essay_grader_result_no_rubric')}
            icon={BookOpenCheck}
            active={settingsPanel === 'rubric'}
            onClick={() => onSettingsPanelChange('rubric')}
            actionLabel={localize('com_essay_grader_result_change_rubric')}
          />
        )}
        <SettingGroup
          title={localize('com_essay_grader_result_feedback_style')}
          value={MODE_LABEL[result.mode]}
          icon={SlidersHorizontal}
          active={settingsPanel === 'mode'}
          onClick={() => onSettingsPanelChange('mode')}
          actionLabel="Change feedback style"
        />
        <SettingGroup
          title={localize('com_essay_grader_result_grading_parameters')}
          value={`${paragraphs} paragraphs, ${response.wordCount.toLocaleString()} words`}
          icon={FileText}
          active={settingsPanel === 'parameters'}
          onClick={() => onSettingsPanelChange('parameters')}
          actionLabel="Show grading parameters"
        />
        <SettingGroup
          title={localize('com_essay_grader_result_advanced_rules')}
          value={rulesValue}
          icon={Settings2}
          active={settingsPanel === 'rules'}
          onClick={() => onSettingsPanelChange('rules')}
          actionLabel="Edit advanced rules"
        />
      </div>

      {result.mode !== 'PROOFREAD' && (
        <button
          type="button"
          onClick={onRunProofread}
          disabled={pendingAction !== null}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-400 bg-blue-500/10 px-4 text-sm font-bold text-blue-600 transition-colors hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingAction === 'mode:PROOFREAD' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <SpellCheck className="h-4 w-4" aria-hidden="true" />
          )}
          {pendingAction === 'mode:PROOFREAD'
            ? localize('com_essay_grader_result_checking_grammar')
            : localize('com_essay_grader_result_run_grammar_check')}
        </button>
      )}

      <section className="mt-5">
        <h3 className="text-sm font-bold text-text-primary">
          {localize('com_essay_grader_result_instructions')}
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {presets.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onAddPreset(item.instruction)}
              className="rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-500/20"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-border-light bg-surface-secondary px-3 py-3 dark:border-white/10">
          <textarea
            value={instructionDraft}
            onChange={(event) => onInstructionDraftChange(event.target.value)}
            rows={4}
            placeholder={
              result.mode === 'PROOFREAD'
                ? 'What should the checker focus on? For example: misspelled words only.'
                : 'What should change for this result? For example: focus more on evidence.'
            }
            className="block w-full resize-y border-0 bg-transparent text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-tertiary focus:ring-0"
          />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClearInstructions}
              disabled={!instructionsReady || pendingAction !== null}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-primary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {localize('com_essay_grader_result_clear')}
            </button>
            <button
              type="button"
              onClick={onApplyInstructions}
              disabled={!instructionsReady || pendingAction !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction === 'instructions' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {pendingAction === 'instructions' ? 'Rerunning' : localize('com_essay_grader_result_apply')}
            </button>
          </div>
        </div>
      </section>

      {actionError && (
        <p className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
          {actionError}
        </p>
      )}

      {pendingAction && pendingAction !== 'instructions' && (
        <p className="mt-4 rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-secondary dark:border-white/10">
          Rerunning the grader with the selected setting…
        </p>
      )}
    </div>
  );
};

const SettingsSheet = ({
  panel,
  response,
  rubrics,
  pendingAction,
  selectedRules,
  onClose,
  onSwitchMode,
  onChangeRubric,
  onToggleRule,
}: {
  panel: Exclude<SettingsPanel, null>;
  response: GradingResponse;
  rubrics: RubricSummary[];
  pendingAction: string | null;
  selectedRules: string[];
  onClose: () => void;
  onSwitchMode: (mode: GradingMode) => void;
  onChangeRubric: (rubric: RubricSummary) => void;
  onToggleRule: (id: string) => void;
}) => {
  const { result } = response;
  const title =
    panel === 'rubric'
      ? 'Rubric'
      : panel === 'mode'
        ? 'Feedback Style'
        : panel === 'parameters'
          ? 'Grading Parameters'
          : 'Advanced Rules';
  const description =
    panel === 'rubric'
      ? 'Rerun this submission against a different rubric from the general set.'
      : panel === 'mode'
        ? 'Choose how the grader should respond to this essay.'
        : panel === 'parameters'
          ? 'Quick quality signals from the submitted writing.'
          : 'Layer extra grading constraints into the next AI instruction pass.';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
    >
      <button type="button" aria-label="Close customization panel" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border border-border-light bg-surface-primary px-5 py-5 shadow-2xl dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-text-primary">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">{description}</p>
          </div>
          <IconButton label="Close customization panel" onClick={onClose}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </IconButton>
        </div>

        {panel === 'rubric' && (
          <div className="mt-5 grid gap-2">
            {rubrics.length === 0 && (
              <p className="text-sm text-text-secondary">
                No general rubrics loaded. Go back to grade another submission to browse by state.
              </p>
            )}
            {rubrics.map((rubric) => {
              const selected = rubric.id === result.rubric?.id;
              return (
                <button
                  key={rubric.id}
                  type="button"
                  disabled={selected || pendingAction !== null}
                  onClick={() => onChangeRubric(rubric)}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                    selected
                      ? 'border-blue-400 bg-blue-500/10 text-text-primary'
                      : 'border-border-light bg-surface-primary text-text-secondary hover:border-blue-300 hover:bg-surface-secondary dark:border-white/10',
                    pendingAction !== null && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-bold">{rubric.name}</span>
                    {selected && (
                      <span className="rounded-full bg-surface-primary px-2 py-0.5 text-xs font-bold text-blue-600">
                        Active
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed">
                    {rubric.gradeBand} · {rubric.totalPoints} points · {rubric.criteria.length} criteria
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {panel === 'mode' && (
          <div className="mt-5 grid gap-2">
            {TOOL_MODES.map((option) => {
              const selected = option.mode === result.mode;
              const blocked = option.needsRubric && result.rubric === null;
              return (
                <button
                  key={option.mode}
                  type="button"
                  disabled={selected || blocked || pendingAction !== null}
                  onClick={() => onSwitchMode(option.mode)}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                    selected
                      ? 'border-blue-400 bg-blue-500/10 text-text-primary'
                      : 'border-border-light bg-surface-primary text-text-secondary hover:border-blue-300 hover:bg-surface-secondary dark:border-white/10',
                    (blocked || pendingAction !== null) && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-bold">{option.label}</span>
                    {selected && (
                      <span className="rounded-full bg-surface-primary px-2 py-0.5 text-xs font-bold text-blue-600">
                        Active
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed">{option.returns}</span>
                  {blocked && <span className="mt-2 block text-xs font-semibold text-red-500">Choose a rubric first.</span>}
                </button>
              );
            })}
          </div>
        )}

        {panel === 'parameters' && (
          <div className="mt-5">
            <MetricGrid result={result} />
          </div>
        )}

        {panel === 'rules' && (
          <div className="mt-5 space-y-2">
            {ADVANCED_RULES.map((rule) => (
              <label
                key={rule.id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors',
                  selectedRules.includes(rule.id)
                    ? 'border-blue-400 bg-blue-500/10 text-text-primary'
                    : 'border-border-light bg-surface-primary text-text-secondary hover:border-blue-300 hover:bg-surface-secondary dark:border-white/10',
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedRules.includes(rule.id)}
                  onChange={() => onToggleRule(rule.id)}
                  className="mt-0.5 h-4 w-4 accent-blue-600"
                />
                <span>
                  <span className="block font-bold text-text-primary">{rule.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed">{rule.instruction}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const SettingGroup = ({
  title,
  value,
  icon: IconComponent,
  active,
  actionLabel,
  onClick,
}: {
  title: string;
  value: string;
  icon: ResultIcon;
  active?: boolean;
  actionLabel: string;
  onClick: () => void;
}) => (
  <section>
    <h3 className="text-xs font-bold uppercase tracking-wide text-text-tertiary">{title}</h3>
    <button
      type="button"
      onClick={onClick}
      aria-label={actionLabel}
      aria-expanded={active}
      className={cn(
        'mt-2 flex min-h-[3rem] w-full items-center gap-3 rounded-[10px] border bg-surface-primary px-3.5 text-left transition-colors',
        active ? 'border-blue-400 bg-blue-500/10' : 'border-border-light hover:border-blue-300 hover:bg-surface-secondary dark:border-white/10',
      )}
    >
      <IconComponent className="h-4 w-4 shrink-0 text-blue-500" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">{value}</span>
      <span className="shrink-0 text-xs font-bold text-blue-600">Change</span>
    </button>
  </section>
);

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
  <div
    role="tablist"
    aria-label={label}
    className="flex shrink-0 items-center rounded-lg border border-border-light bg-surface-secondary p-0.5 text-sm font-semibold dark:border-white/10"
  >
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="tab"
        aria-selected={option.value === value}
        onClick={() => onChange(option.value)}
        className={cn(
          'rounded-md px-3 py-1.5 transition-colors',
          option.value === value ? 'bg-blue-600 text-white shadow-sm' : 'text-text-tertiary hover:bg-surface-primary hover:text-text-primary',
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
  );
}

const MetricTab = ({
  label,
  value,
  icon: IconComponent,
  active,
  disabled,
  disabledHint,
  onClick,
}: {
  label: string;
  value: string;
  icon: ResultIcon;
  active?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active}
    title={disabled ? disabledHint : undefined}
    className={cn(
      'flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors',
      disabled ? 'cursor-not-allowed opacity-40' : active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
    )}
  >
    <IconComponent className="h-3.5 w-3.5" aria-hidden />
    <span className="font-semibold">{label}</span>
    <span className={cn('tabular-nums font-bold', active && !disabled ? 'text-text-primary' : 'text-text-tertiary')}>
      {value}
    </span>
  </button>
);

const ReadableEssay = ({ title, text }: { title: string | null; text: string }) => {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <article className="rounded-xl bg-surface-secondary/50 px-4 py-4">
      {title && <h3 className="text-sm font-bold text-text-primary">{title}</h3>}
      <div className={cn('space-y-4 text-[15px] leading-8 text-text-primary', title && 'mt-3')}>
        {paragraphs.map((paragraph, index) => (
          <p key={`${paragraph.slice(0, 20)}-${index}`}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
};

const MetricGrid = ({ result }: { result: GradingResultDocument }) => {
  const metrics: Array<[string, string]> = [
    ['Words', result.metrics.words.toLocaleString()],
    ['Sentences', result.metrics.sentences.toLocaleString()],
    ['Paragraphs', result.metrics.paragraphs.toLocaleString()],
    ['Avg. sentence', `${result.metrics.averageSentenceWords} words`],
    ['Longest paragraph', `${result.metrics.longestParagraphWords} words`],
    ['Confidence', `${Math.round(result.confidence * 100)}%`],
  ];

  return (
    <dl className="grid grid-cols-2 gap-2">
      {metrics.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-surface-secondary px-3 py-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</dt>
          <dd className="mt-1 text-sm font-bold text-text-primary">{value}</dd>
        </div>
      ))}
    </dl>
  );
};

const SmallList = ({ title, items }: { title: string; items: string[] }) => {
  if (items.length === 0) return null;

  return (
    <section>
      <h3 className="text-sm font-bold text-text-primary">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-relaxed text-text-secondary">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
};

function buildRows(result: GradingResultDocument): CriterionResult[] {
  if (result.criteria.length > 0) return result.criteria;

  return [
    {
      criterionId: 'general',
      name: 'What to improve',
      description: '',
      maxPoints: 0,
      points: null,
      judged: true,
      levelLabel: null,
      rationale: result.overallComment || 'The grader returned general improvement notes for this piece.',
      evidence: result.generalEvidence,
    },
  ];
}

function filterRows(rows: CriterionResult[], metricView: ResultMetricView, mode: GradingMode): CriterionResult[] {
  if (mode === 'PROOFREAD') {
    if (metricView === 'rubric') return [];
    if (metricView === 'evidence') {
      const evidenceRows = rows.filter((criterion) => criterion.evidence.length > 0);
      return evidenceRows.length > 0 ? evidenceRows : rows;
    }
    return rows.filter((criterion) => isGrammarCriterion(criterion));
  }

  if (metricView === 'grammar') {
    return rows.filter((criterion) => isGrammarCriterion(criterion));
  }
  if (metricView === 'evidence') {
    const evidenceRows = rows.filter((criterion) => criterion.evidence.length > 0);
    return evidenceRows.length > 0 ? evidenceRows : rows;
  }
  return rows;
}

function emptyMetricMessage(metricView: ResultMetricView, mode: GradingMode): string {
  if (mode === 'PROOFREAD' && metricView === 'rubric') {
    return 'Grammar and spell check does not use a rubric or award points.';
  }
  if (mode === 'PROOFREAD') {
    return 'No spelling, grammar, punctuation or sentence-clarity issues were flagged in this view.';
  }
  if (metricView === 'grammar') {
    return 'This rubric does not include a separate grammar or conventions criterion.';
  }
  if (metricView === 'evidence') {
    return 'No evidence spans were returned for this result.';
  }
  return 'There is nothing in this filter for the current result. Choose another tab or rerun the grader with more specific instructions.';
}

function calculateTotal(criteria: CriterionResult[]): GradingResultDocument['total'] {
  const judged = criteria.filter((criterion) => criterion.judged && criterion.points !== null && criterion.maxPoints > 0);
  const maxPoints = judged.reduce((sum, criterion) => sum + criterion.maxPoints, 0);
  if (maxPoints === 0) return null;

  const points = judged.reduce((sum, criterion) => sum + (criterion.points ?? 0), 0);
  const unjudged = criteria.length - judged.length;

  return { points, maxPoints, percentage: Math.round((points / maxPoints) * 100), unjudged };
}

function buildInstructions(draft: string, selectedRules: string[]): string {
  return [draft.trim(), ...ADVANCED_RULES.filter((rule) => selectedRules.includes(rule.id)).map((rule) => rule.instruction)]
    .filter(Boolean)
    .join('\n');
}

function encodeGraderDirections(instructions?: string): string | undefined {
  const trimmed = instructions?.trim();
  return trimmed ? `${GRADER_DIRECTIONS_MARKER}\n${trimmed}` : undefined;
}

function appendInstruction(current: string, instruction: string): string {
  const trimmed = current.trim();
  return trimmed ? `${trimmed}\n${instruction}` : instruction;
}

function readError(cause: unknown, fallback: string): string {
  return cause instanceof EssayGraderApiError ? cause.message : fallback;
}

async function copyPlainText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * The grammar tab's badge is only ever an issue count from an actual
 * proofread pass — never a percentage borrowed from an incidentally
 * grammar-named rubric criterion (that number doesn't mean "grammar
 * issues" and was confusing). Until a proofread pass exists for this
 * submission, there's nothing to count yet.
 */
function grammarScore(result: GradingResultDocument): string {
  if (result.mode === 'PROOFREAD') {
    return String(countProofreadIssues(result));
  }
  return '–';
}

function rubricScore(result: GradingResultDocument): string {
  if (!result.total) return modeNeedsRubric(result.mode) ? '0%' : '-';
  return `${result.total.percentage}%`;
}

function evidenceCountLabel(result: GradingResultDocument): string {
  return String(countEvidence(result));
}

function countEvidence(result: GradingResultDocument): number {
  return result.criteria.reduce((sum, row) => sum + row.evidence.length, 0) + result.generalEvidence.length;
}

function countProofreadIssues(result: GradingResultDocument): number {
  return result.criteria
    .filter((row) => isGrammarCriterion(row))
    .reduce((sum, row) => sum + row.evidence.filter((span) => span.polarity === 'GROWTH').length, 0);
}

function isGrammarCriterion(criterion: CriterionResult): boolean {
  return /proofread|language|grammar|convention|mechanic|sentence|clarity|usage|punctuation|capitalization|spelling|syntax/i.test(
    `${criterion.name} ${criterion.description}`,
  );
}

export default EssayGraderRoute;
