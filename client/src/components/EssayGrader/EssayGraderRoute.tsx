import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpenCheck,
  ChevronLeft,
  FileText,
  Loader2,
  Plus,
  Sparkles,
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
  EssayGraderApiError,
} from './api';
import type {
  ToolStatus,
  CustomRubric,
  RubricSummary,
  GradingResponse,
  CriterionResult,
} from './types';

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
      setServiceError(null);
      try {
        const [nextRubrics, nextStatus] = await Promise.all([listRubrics(), fetchToolStatus()]);
        if (cancelled) {
          return;
        }

        setRubrics(nextRubrics);
        setSelectedRubricId((current) => current || nextRubrics[0]?.id || '');
        setStatus(nextStatus);
      } catch (cause) {
        if (cancelled) {
          return;
        }

        setServiceError(
          cause instanceof EssayGraderApiError && cause.status !== 0
            ? cause.message
            : localize('com_essay_grader_service_error'),
        );
      } finally {
        if (!cancelled) {
          setLoadingRubrics(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [localize]);

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
          assignmentPrompt={instructions.trim()}
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
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
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

const ResultView = ({
  response,
  assignmentPrompt,
  onBack,
}: {
  response: GradingResponse;
  assignmentPrompt: string;
  onBack: () => void;
}) => {
  const localize = useLocalize();
  const { result } = response;
  const resultTitle = response.title || localize('com_essay_grader_untitled');

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 md:px-8 xl:px-12">
      <header className="bg-surface-primary/80 dark:bg-surface-primary/40 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border-light p-5 shadow-sm backdrop-blur dark:border-white/10">
        <div>
          <p className="text-sm font-semibold text-blue-500">
            {localize('com_essay_grader_result')}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-text-primary">
            {resultTitle}
          </h1>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border-light px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-secondary dark:border-white/10"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {localize('com_essay_grader_grade_another')}
        </button>
      </header>

      <AssignmentContextSummary title={resultTitle} prompt={assignmentPrompt} />

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label={localize('com_essay_grader_score')}
          value={
            result.total
              ? `${Math.round(result.total.percentage)}%`
              : localize('com_essay_grader_no_score')
          }
        />
        <MetricCard
          label={localize('com_essay_grader_points_total')}
          value={result.total ? `${result.total.points}/${result.total.maxPoints}` : '-'}
        />
        <MetricCard
          label={localize('com_essay_grader_confidence')}
          value={`${Math.round(result.confidence * 100)}%`}
        />
        <MetricCard
          label={localize('com_essay_grader_words')}
          value={numberFormatter.format(response.wordCount)}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <main className="space-y-5">
          <section className="bg-surface-primary/80 dark:bg-surface-primary/40 rounded-2xl border border-border-light p-5 shadow-sm dark:border-white/10">
            <h2 className="text-lg font-semibold text-text-primary">
              {localize('com_essay_grader_overall')}
            </h2>
            <p className="mt-3 text-sm leading-7 text-text-secondary">{result.overallComment}</p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <NoteList title={localize('com_essay_grader_strengths')} items={result.strengths} />
              <NoteList title={localize('com_essay_grader_next_steps')} items={result.nextSteps} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-text-primary">
              {localize('com_essay_grader_criteria')}
            </h2>
            {result.criteria.map((criterion) => (
              <CriterionCard key={criterion.criterionId} criterion={criterion} />
            ))}
          </section>
        </main>

        <aside className="bg-surface-primary/80 dark:bg-surface-primary/40 rounded-2xl border border-border-light p-5 shadow-sm dark:border-white/10 xl:sticky xl:top-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
            <FileText className="h-5 w-5" aria-hidden="true" />
            {localize('com_essay_grader_submission')}
          </h2>
          <div className="mt-4 max-h-[620px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-border-light bg-surface-secondary p-4 text-sm leading-7 text-text-secondary dark:border-white/10">
            {response.text}
          </div>
        </aside>
      </div>
    </div>
  );
};

const AssignmentContextSummary = ({ title, prompt }: { title: string; prompt: string }) => {
  const localize = useLocalize();
  const hasPrompt = prompt.trim().length > 0;

  return (
    <section className="bg-surface-primary/80 dark:bg-surface-primary/40 rounded-2xl border border-border-light p-5 shadow-sm dark:border-white/10">
      <p className="text-sm font-semibold text-blue-500">
        {localize('com_essay_grader_assignment')}
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,0.35fr)_minmax(0,1fr)]">
        <div className="bg-surface-secondary/65 rounded-xl p-4 dark:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            {localize('com_essay_grader_assignment_title')}
          </p>
          <p className="mt-2 break-words text-sm font-semibold leading-6 text-text-primary">
            {title}
          </p>
        </div>
        <div className="bg-surface-secondary/65 rounded-xl p-4 dark:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            {localize('com_essay_grader_assignment_prompt')}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">
            {hasPrompt ? prompt : localize('com_essay_grader_optional_context_hint')}
          </p>
        </div>
      </div>
    </section>
  );
};

const MetricCard = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-surface-primary/80 dark:bg-surface-primary/40 rounded-2xl border border-border-light p-5 shadow-sm dark:border-white/10">
    <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</p>
    <p className="mt-2 text-2xl font-bold text-text-primary">{value}</p>
  </div>
);

const NoteList = ({ title, items }: { title: string; items: string[] }) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items.map((item, index) => (
          <li
            key={`${title}-${index}`}
            className="flex gap-2 text-sm leading-6 text-text-secondary"
          >
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

const CriterionCard = ({ criterion }: { criterion: CriterionResult }) => {
  const localize = useLocalize();

  return (
    <article className="bg-surface-primary/80 dark:bg-surface-primary/40 rounded-2xl border border-border-light p-5 shadow-sm dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">{criterion.name}</h3>
          <p className="mt-1 text-sm text-text-secondary">{criterion.description}</p>
        </div>
        <div className="rounded-xl bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-500">
          {criterion.points ?? '-'} / {criterion.maxPoints}
        </div>
      </div>
      {criterion.levelLabel ? (
        <p className="mt-3 text-sm font-semibold text-text-primary">{criterion.levelLabel}</p>
      ) : null}
      <p className="mt-2 text-sm leading-7 text-text-secondary">{criterion.rationale}</p>
      {criterion.evidence.length > 0 ? (
        <div className="mt-4 space-y-3">
          <h4 className="text-sm font-semibold text-text-primary">
            {localize('com_essay_grader_evidence')}
          </h4>
          {criterion.evidence.map((span, index) => (
            <blockquote
              key={`${criterion.criterionId}-${span.start}-${index}`}
              className="rounded-xl border border-border-light bg-surface-secondary p-3 text-sm text-text-secondary dark:border-white/10"
            >
              <p className="italic">"{span.quote}"</p>
              <p className="mt-2">{span.note}</p>
            </blockquote>
          ))}
        </div>
      ) : null}
    </article>
  );
};

export default EssayGraderRoute;
