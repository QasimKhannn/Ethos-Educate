/* eslint-disable i18next/no-literal-string */

import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, Grid2X2, List, Presentation as PresentationIcon } from 'lucide-react';
import {
  Button,
  Checkbox,
  Input,
  Label,
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  Textarea,
} from '@librechat/client';
import type { Agent } from 'librechat-data-provider';
import { cn } from '~/utils';
import useStartAgentChat from './useStartAgentChat';
import {
  assessmentQuestionTypes,
  buildAssessmentIntakePrompt,
  buildPresentationIntakePrompt,
  buildWorksheetIntakePrompt,
  createAssessmentIntakeValues,
  createPresentationIntakeValues,
  createWorksheetIntakeValues,
  getAgentIntakeTemplate,
  gradeOptions,
  presentationDeckTypes,
  presentationGradeBands,
  presentationToneOptions,
  versionMethods,
  worksheetQuestionTypes,
  type AssessmentIntakeValues,
  type PresentationIntakeValues,
  type WorksheetIntakeValues,
} from './agentIntake';

interface AgentIntakeDialogProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const textareaClass =
  'w-full rounded-xl border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary';

type IntakeOption = {
  value: string;
  label: string;
};

const difficultyOptions = ['Easy', 'Grade-level', 'Challenging', 'Mixed', 'Other'];
const assessmentTypeOptions = ['Quiz', 'Test', 'Checkpoint', 'Benchmark'];
const answerKeyOptions = [
  'One answer key for each version',
  'Combined answer key',
  'No answer key',
];
const decisionOptions = ['Yes', 'No', 'Let the agent decide'];
const sharedObjectiveOptions = ['Yes', 'No', 'Other'];
const versionLabelOptions = ['Version A, B, C, D, E', 'Version 1, 2, 3, 4, 5', 'Custom'];
const versionCountOptions = ['1', '2', '3', '4', '5'];
const templatePreviewPalettes: Record<
  string,
  { primary: string; secondary: string; accent: string; soft: string }
> = {
  'K-2': { primary: '#2563eb', secondary: '#f97316', accent: '#16a34a', soft: '#eff6ff' },
  '3-5': { primary: '#1d4ed8', secondary: '#059669', accent: '#ea580c', soft: '#f8fafc' },
  '6-8': { primary: '#0f766e', secondary: '#7c3aed', accent: '#dc2626', soft: '#f0fdfa' },
  '9-12': { primary: '#0f172a', secondary: '#2563eb', accent: '#d97706', soft: '#f8fafc' },
};

const toOptions = (options: string[]): IntakeOption[] =>
  options.map((option) => ({ value: option, label: option }));

function IntakeSelect({
  id,
  label,
  value,
  placeholder = 'Select an option',
  options,
  helperText,
  allowEmpty = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  options: IntakeOption[];
  helperText?: string;
  allowEmpty?: boolean;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <div
      className="relative space-y-2"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <Label id={`${id}-label`} htmlFor={id}>
        {label}
      </Label>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${id}-label ${id}`}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-xl border border-border-light bg-surface-primary px-3 text-left text-sm shadow-sm transition-colors',
          'hover:border-border-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary',
          value ? 'text-text-primary' : 'text-text-secondary',
        )}
      >
        <span className="truncate">{selectedLabel ?? placeholder}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {helperText ? <p className="text-xs leading-5 text-text-secondary">{helperText}</p> : null}
      {isOpen ? (
        <div
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute left-0 right-0 top-full z-[220] mt-1 max-h-64 overflow-y-auto rounded-xl border border-border-medium bg-surface-primary p-1 shadow-xl"
          onMouseDown={(event) => event.preventDefault()}
        >
          {allowEmpty ? (
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={cn(
                'w-full rounded-lg px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-secondary',
                !value && 'bg-surface-secondary font-medium text-text-primary',
              )}
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
            >
              {placeholder}
            </button>
          ) : null}
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              className={cn(
                'w-full rounded-lg px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-secondary',
                value === option.value && 'bg-surface-secondary font-medium',
              )}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function IntakeSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-light bg-surface-primary p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-text-secondary">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function RadioCardGroup<TValue extends string>({
  label,
  name,
  value,
  choices,
  onChange,
}: {
  label: string;
  name: string;
  value: TValue;
  choices: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-text-primary">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {choices.map((choice) => {
          const selected = value === choice.value;
          return (
            <Label
              key={choice.value}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-normal transition-colors',
                selected
                  ? 'border-sky-500/60 bg-sky-500/10 text-text-primary'
                  : 'border-border-light bg-surface-primary text-text-secondary hover:border-border-medium hover:bg-surface-secondary',
              )}
            >
              <input
                type="radio"
                name={name}
                value={choice.value}
                checked={selected}
                onChange={() => onChange(choice.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  'h-3.5 w-3.5 rounded-full border transition-colors',
                  selected ? 'border-sky-500 bg-sky-500' : 'border-border-medium',
                )}
                aria-hidden="true"
              />
              {choice.label}
            </Label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ChoiceGroup({
  label,
  choices,
  selected,
  onChange,
}: {
  label: string;
  choices: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-text-primary">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {choices.map((choice) => {
          const id = `${label}-${choice}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
          const checked = selected.includes(choice);

          return (
            <Label
              key={choice}
              htmlFor={id}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-normal transition-colors',
                checked
                  ? 'border-sky-500/60 bg-sky-500/10 text-text-primary'
                  : 'border-border-light bg-surface-primary text-text-secondary hover:border-border-medium hover:bg-surface-secondary',
              )}
            >
              <Checkbox
                id={id}
                checked={checked}
                aria-label={choice}
                className="shrink-0"
                onCheckedChange={(nextChecked) => {
                  onChange(
                    nextChecked === true
                      ? [...selected, choice]
                      : selected.filter((value) => value !== choice),
                  );
                }}
              />
              {choice}
            </Label>
          );
        })}
      </div>
    </fieldset>
  );
}

function GradeField({
  grade,
  customGrade,
  onGradeChange,
  onCustomGradeChange,
}: {
  grade: string;
  customGrade: string;
  onGradeChange: (value: string) => void;
  onCustomGradeChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <IntakeSelect
        id="agent-intake-grade"
        label="Grade / age"
        value={grade}
        placeholder="Select grade / age"
        options={toOptions(gradeOptions)}
        allowEmpty
        onChange={onGradeChange}
      />
      {grade === 'Other' ? (
        <Input
          value={customGrade}
          onChange={(event) => onCustomGradeChange(event.target.value)}
          placeholder="Enter grade or age"
          aria-label="Custom grade or age"
        />
      ) : null}
    </div>
  );
}

function PresentationThumbnail({
  gradeBand,
  deckType,
  compact = false,
}: {
  gradeBand: string;
  deckType: string;
  compact?: boolean;
}) {
  const palette = templatePreviewPalettes[gradeBand] ?? templatePreviewPalettes['3-5'];
  const isLesson = deckType === 'teacher_lesson';
  const isReview = deckType === 'review_assessment';
  let bottomAccent = palette.accent;
  let previewBody: React.ReactNode;

  if (isLesson) {
    bottomAccent = palette.primary;
    previewBody = (
      <>
        <div className="absolute left-[8%] top-[38%] h-[30%] w-[26%] rounded-md bg-slate-100 ring-1 ring-slate-200" />
        <div className="absolute left-[38%] top-[38%] h-[30%] w-[26%] rounded-md bg-slate-100 ring-1 ring-slate-200" />
        <div className="absolute left-[68%] top-[38%] h-[30%] w-[24%] rounded-md bg-slate-100 ring-1 ring-slate-200" />
        <div className="absolute bottom-[18%] left-[8%] h-[6%] w-[70%] rounded-full bg-slate-200" />
      </>
    );
  } else if (isReview) {
    bottomAccent = palette.secondary;
    previewBody = (
      <>
        <div className="absolute left-[8%] top-[35%] h-[10%] w-[80%] rounded-full bg-slate-200" />
        <div className="absolute left-[8%] top-[52%] h-[10%] w-[60%] rounded-full bg-slate-200" />
        <div
          className="absolute bottom-[20%] left-[8%] h-[18%] w-[82%] rounded-md"
          style={{ backgroundColor: palette.soft, border: `1px solid ${palette.secondary}` }}
        />
      </>
    );
  } else {
    previewBody = (
      <>
        <div
          className="absolute left-[8%] top-[34%] h-[34%] w-[34%] rounded-full"
          style={{ backgroundColor: palette.soft, border: `2px solid ${palette.accent}` }}
        />
        <div className="absolute right-[10%] top-[36%] h-[8%] w-[36%] rounded-full bg-slate-200" />
        <div className="absolute right-[10%] top-[52%] h-[8%] w-[28%] rounded-full bg-slate-200" />
        <div
          className="absolute bottom-[18%] right-[10%] h-[6%] w-[44%] rounded-full"
          style={{ backgroundColor: palette.accent }}
        />
      </>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border-light bg-white shadow-sm',
        compact ? 'h-16 w-28 shrink-0' : 'aspect-video w-full',
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-x-0 top-0 h-2" style={{ backgroundColor: palette.primary }} />
      <div className="absolute inset-x-0 bottom-0 h-2" style={{ backgroundColor: bottomAccent }} />
      <div
        className="absolute left-[8%] top-[18%] h-[10%] w-[45%] rounded-sm"
        style={{ backgroundColor: palette.primary }}
      />
      <div className="absolute right-[8%] top-[18%] h-[6%] w-[22%] rounded-full bg-slate-200" />
      {previewBody}
    </div>
  );
}

function TemplateViewToggle({
  value,
  onChange,
}: {
  value: 'gallery' | 'list';
  onChange: (value: 'gallery' | 'list') => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border-light bg-surface-primary p-1">
      {[
        { value: 'gallery' as const, label: 'Gallery', Icon: Grid2X2 },
        { value: 'list' as const, label: 'List', Icon: List },
      ].map(({ value: optionValue, label, Icon }) => (
        <button
          key={optionValue}
          type="button"
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors',
            value === optionValue
              ? 'bg-surface-secondary text-text-primary shadow-sm'
              : 'hover:bg-surface-secondary/70 text-text-secondary hover:text-text-primary',
          )}
          onClick={() => onChange(optionValue)}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

function PresentationTemplatePicker({
  gradeBand,
  deckType,
  view,
  onDeckTypeChange,
  onViewChange,
}: {
  gradeBand: string;
  deckType: string;
  view: 'gallery' | 'list';
  onDeckTypeChange: (value: string) => void;
  onViewChange: (value: 'gallery' | 'list') => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 rounded-lg bg-surface-secondary p-1.5 text-text-secondary">
            <PresentationIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-text-primary">Choose template style</p>
            <p className="text-xs leading-5 text-text-secondary">
              Preview the selected grade band and pick the deck flow.
            </p>
          </div>
        </div>
        <TemplateViewToggle value={view} onChange={onViewChange} />
      </div>
      <div className={cn(view === 'gallery' ? 'grid gap-3 lg:grid-cols-3' : 'space-y-2')}>
        {presentationDeckTypes.map((template) => {
          const selected = deckType === template.value;

          return (
            <button
              key={template.value}
              type="button"
              aria-pressed={selected}
              className={cn(
                'group w-full rounded-xl border bg-surface-primary text-left transition-all hover:border-border-medium hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary',
                selected
                  ? 'border-sky-500/70 shadow-sm ring-1 ring-sky-500/30'
                  : 'border-border-light',
                view === 'list' && 'flex items-center gap-3 p-3',
              )}
              onClick={() => onDeckTypeChange(template.value)}
            >
              {view === 'gallery' ? (
                <div className="space-y-3 p-3">
                  <PresentationThumbnail gradeBand={gradeBand} deckType={template.value} />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{template.label}</p>
                      <p className="mt-1 text-xs leading-5 text-text-secondary">
                        {template.description}
                      </p>
                    </div>
                    {selected ? (
                      <span className="rounded-full bg-sky-500 p-1 text-white">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    ) : null}
                  </div>
                  <p className="inline-flex rounded-full bg-surface-secondary px-2 py-1 text-xs text-text-secondary">
                    11-slide template
                  </p>
                </div>
              ) : (
                <>
                  <PresentationThumbnail gradeBand={gradeBand} deckType={template.value} compact />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {template.label}
                      </p>
                      {selected ? (
                        <Check className="h-4 w-4 shrink-0 text-sky-500" aria-hidden="true" />
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-xs leading-5 text-text-secondary">
                      {template.description}
                    </p>
                  </div>
                  <span className="hidden rounded-full bg-surface-secondary px-2 py-1 text-xs text-text-secondary sm:inline-flex">
                    11 slides
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WorksheetFields({
  values,
  setValues,
}: {
  values: WorksheetIntakeValues;
  setValues: React.Dispatch<React.SetStateAction<WorksheetIntakeValues>>;
}) {
  const update = <K extends keyof WorksheetIntakeValues>(key: K, value: WorksheetIntakeValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-5">
      <IntakeSection
        title="Core Details"
        description="Start with the topic and grade. A short prompt is enough; these fields keep the request clear."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="worksheet-topic">Worksheet topic</Label>
            <Input
              id="worksheet-topic"
              value={values.topic}
              onChange={(event) => update('topic', event.target.value)}
              placeholder="e.g., comparing fractions"
            />
          </div>
          <GradeField
            grade={values.grade}
            customGrade={values.customGrade}
            onGradeChange={(value) => update('grade', value)}
            onCustomGradeChange={(value) => update('customGrade', value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="worksheet-objective">Learning objective / skill</Label>
            <Input
              id="worksheet-objective"
              value={values.objective}
              onChange={(event) => update('objective', event.target.value)}
              placeholder="What should students practice?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="worksheet-question-count">Number of questions</Label>
            <Input
              id="worksheet-question-count"
              type="number"
              min="1"
              max="60"
              value={values.questionCount}
              onChange={(event) => update('questionCount', event.target.value)}
            />
          </div>
        </div>
      </IntakeSection>

      <IntakeSection
        title="Worksheet Design"
        description="Choose the practice mix. The agent will still adapt layout by grade and subject."
      >
        <ChoiceGroup
          label="Question types"
          choices={worksheetQuestionTypes}
          selected={values.questionTypes}
          onChange={(value) => update('questionTypes', value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="worksheet-other-question-type">Other question type</Label>
            <Input
              id="worksheet-other-question-type"
              value={values.otherQuestionType}
              onChange={(event) => update('otherQuestionType', event.target.value)}
              placeholder="Optional"
            />
          </div>
          <IntakeSelect
            id="worksheet-difficulty"
            label="Difficulty level"
            value={values.difficulty}
            options={toOptions(difficultyOptions)}
            onChange={(value) => update('difficulty', value)}
          />
        </div>
        {values.difficulty === 'Other' ? (
          <div className="space-y-2">
            <Label htmlFor="worksheet-other-difficulty">Custom difficulty</Label>
            <Input
              id="worksheet-other-difficulty"
              value={values.otherDifficulty}
              onChange={(event) => update('otherDifficulty', event.target.value)}
              placeholder="Describe the difficulty"
            />
          </div>
        ) : null}
        <RadioCardGroup
          label="Include an answer key?"
          name="worksheet-answer-key"
          value={values.includeAnswerKey}
          choices={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
          onChange={(value) => update('includeAnswerKey', value)}
        />
      </IntakeSection>

      <IntakeSection
        title="Teacher Details"
        description="Add must-use words, standards, examples, or constraints the worksheet should respect."
      >
        <div className="space-y-2">
          <Label htmlFor="worksheet-content">
            Specific content, vocabulary, or skills to include
          </Label>
          <Textarea
            id="worksheet-content"
            className={textareaClass}
            rows={3}
            value={values.specificContent}
            onChange={(event) => update('specificContent', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="worksheet-notes">Anything else to include</Label>
          <Textarea
            id="worksheet-notes"
            className={textareaClass}
            rows={4}
            value={values.notes}
            onChange={(event) => update('notes', event.target.value)}
          />
        </div>
      </IntakeSection>
    </div>
  );
}

function AssessmentFields({
  values,
  setValues,
}: {
  values: AssessmentIntakeValues;
  setValues: React.Dispatch<React.SetStateAction<AssessmentIntakeValues>>;
}) {
  const update = <K extends keyof AssessmentIntakeValues>(
    key: K,
    value: AssessmentIntakeValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }));
  const showVersionOptions = Number(values.versionCount) > 1;

  return (
    <div className="space-y-5">
      <IntakeSection
        title="Assessment Basics"
        description="Tell the agent what should be measured and who the assessment is for."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="assessment-topic">Topic or source material</Label>
            <Input
              id="assessment-topic"
              value={values.topic}
              onChange={(event) => update('topic', event.target.value)}
              placeholder="e.g., fractions on a number line"
            />
          </div>
          <GradeField
            grade={values.grade}
            customGrade={values.customGrade}
            onGradeChange={(value) => update('grade', value)}
            onCustomGradeChange={(value) => update('customGrade', value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="assessment-objective">Learning objective / standard</Label>
            <Input
              id="assessment-objective"
              value={values.objective}
              onChange={(event) => update('objective', event.target.value)}
            />
          </div>
          <IntakeSelect
            id="assessment-type"
            label="Assessment type"
            value={values.assessmentType}
            options={toOptions(assessmentTypeOptions)}
            onChange={(value) => update('assessmentType', value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="assessment-source">Specific content, vocabulary, or source notes</Label>
          <Textarea
            id="assessment-source"
            className={textareaClass}
            rows={3}
            value={values.sourceMaterial}
            onChange={(event) => update('sourceMaterial', event.target.value)}
          />
        </div>
      </IntakeSection>

      <IntakeSection
        title="Question Design"
        description="Set the item mix and difficulty target. Use notes below for any special grading expectations."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="assessment-question-count">Number of questions</Label>
            <Input
              id="assessment-question-count"
              type="number"
              min="1"
              max="80"
              value={values.questionCount}
              onChange={(event) => update('questionCount', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assessment-difficulty">Difficulty distribution</Label>
            <Input
              id="assessment-difficulty"
              value={values.difficultyDistribution}
              onChange={(event) => update('difficultyDistribution', event.target.value)}
            />
          </div>
        </div>
        <ChoiceGroup
          label="Question types"
          choices={assessmentQuestionTypes}
          selected={values.questionTypes}
          onChange={(value) => update('questionTypes', value)}
        />
        <div className="space-y-2">
          <Label htmlFor="assessment-other-question-type">Other question type</Label>
          <Input
            id="assessment-other-question-type"
            value={values.otherQuestionType}
            onChange={(event) => update('otherQuestionType', event.target.value)}
            placeholder="Optional"
          />
        </div>
      </IntakeSection>

      <IntakeSection
        title="Versioning & Answer Keys"
        description="Use multiple versions for retakes, parallel forms, or light anti-cheating needs."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <IntakeSelect
            id="assessment-version-count"
            label="How many versions?"
            value={values.versionCount}
            options={toOptions(versionCountOptions)}
            onChange={(value) => update('versionCount', value)}
          />
          <IntakeSelect
            id="assessment-answer-keys"
            label="Answer keys"
            value={values.answerKeyMode}
            options={toOptions(answerKeyOptions)}
            onChange={(value) => update('answerKeyMode', value)}
          />
        </div>
        {showVersionOptions ? (
          <div className="space-y-5 rounded-2xl border border-border-light bg-surface-secondary p-4">
            <ChoiceGroup
              label="How should the versions differ?"
              choices={versionMethods}
              selected={values.versionMethods}
              onChange={(value) => update('versionMethods', value)}
            />
            <div className="space-y-2">
              <Label htmlFor="assessment-other-version-method">Other versioning method</Label>
              <Input
                id="assessment-other-version-method"
                value={values.otherVersionMethod}
                onChange={(event) => update('otherVersionMethod', event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <IntakeSelect
                id="assessment-equivalent-difficulty"
                label="Keep difficulty equivalent?"
                value={values.equivalentDifficulty}
                options={toOptions(decisionOptions)}
                onChange={(value) => update('equivalentDifficulty', value)}
              />
              <IntakeSelect
                id="assessment-shared-objectives"
                label="Keep learning objectives the same?"
                value={values.sharedObjectives}
                options={toOptions(sharedObjectiveOptions)}
                onChange={(value) => update('sharedObjectives', value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <IntakeSelect
                id="assessment-version-labels"
                label="Version labels"
                value={values.versionLabels}
                options={toOptions(versionLabelOptions)}
                onChange={(value) => update('versionLabels', value)}
              />
              {values.versionLabels === 'Custom' ? (
                <div className="space-y-2">
                  <Label htmlFor="assessment-custom-version-labels">Custom labels</Label>
                  <Input
                    id="assessment-custom-version-labels"
                    value={values.customVersionLabels}
                    onChange={(event) => update('customVersionLabels', event.target.value)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </IntakeSection>

      <IntakeSection title="Teacher Notes">
        <div className="space-y-2">
          <Label htmlFor="assessment-notes">Anything else about the assessment</Label>
          <Textarea
            id="assessment-notes"
            className={textareaClass}
            rows={4}
            value={values.notes}
            onChange={(event) => update('notes', event.target.value)}
          />
        </div>
      </IntakeSection>
    </div>
  );
}

function PresentationFields({
  values,
  setValues,
}: {
  values: PresentationIntakeValues;
  setValues: React.Dispatch<React.SetStateAction<PresentationIntakeValues>>;
}) {
  const update = <K extends keyof PresentationIntakeValues>(
    key: K,
    value: PresentationIntakeValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-5">
      <IntakeSection
        title="Presentation Basics"
        description="Start with the topic, purpose, and audience. The agent will draft the slide content for review before creating a file."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="presentation-topic">Presentation title or topic</Label>
            <Input
              id="presentation-topic"
              value={values.titleOrTopic}
              onChange={(event) => update('titleOrTopic', event.target.value)}
              placeholder="e.g., Grade 3 pollination lesson"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="presentation-audience">Audience</Label>
            <Input
              id="presentation-audience"
              value={values.audience}
              onChange={(event) => update('audience', event.target.value)}
              placeholder="e.g., Grade 3 students"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="presentation-purpose">Purpose</Label>
            <Input
              id="presentation-purpose"
              value={values.purpose}
              onChange={(event) => update('purpose', event.target.value)}
              placeholder="Teach, review, train, inform, or discuss"
            />
          </div>
          <IntakeSelect
            id="presentation-tone"
            label="Tone"
            value={values.tone}
            options={toOptions(presentationToneOptions)}
            onChange={(value) => update('tone', value)}
          />
        </div>
        {values.tone === 'Other' ? (
          <div className="space-y-2">
            <Label htmlFor="presentation-custom-tone">Custom tone</Label>
            <Input
              id="presentation-custom-tone"
              value={values.customTone}
              onChange={(event) => update('customTone', event.target.value)}
              placeholder="Describe the tone"
            />
          </div>
        ) : null}
      </IntakeSection>

      <IntakeSection
        title="Template"
        description="Pick the approved deck family before the agent drafts the content."
      >
        <div className="grid gap-4 lg:grid-cols-[13rem_1fr]">
          <IntakeSelect
            id="presentation-grade-band"
            label="Template grade band"
            value={values.gradeBand}
            options={toOptions(presentationGradeBands)}
            onChange={(value) => update('gradeBand', value)}
          />
          <PresentationTemplatePicker
            gradeBand={values.gradeBand}
            deckType={values.deckType}
            view={values.templateView}
            onDeckTypeChange={(value) => update('deckType', value)}
            onViewChange={(value) => update('templateView', value)}
          />
        </div>
      </IntakeSection>

      <IntakeSection
        title="Content Direction"
        description="Add the must-cover ideas and any source material the slide draft should follow."
      >
        <div className="space-y-2">
          <Label htmlFor="presentation-key-topics">Key topics to cover</Label>
          <Textarea
            id="presentation-key-topics"
            className={textareaClass}
            rows={3}
            value={values.keyTopics}
            onChange={(event) => update('keyTopics', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="presentation-required-sections">Required sections</Label>
          <Textarea
            id="presentation-required-sections"
            className={textareaClass}
            rows={2}
            value={values.requiredSections}
            onChange={(event) => update('requiredSections', event.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="presentation-source">Images, examples, data, or source material</Label>
          <Textarea
            id="presentation-source"
            className={textareaClass}
            rows={3}
            value={values.sourceMaterial}
            onChange={(event) => update('sourceMaterial', event.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="presentation-branding">Branding/template requirements</Label>
            <Input
              id="presentation-branding"
              value={values.brandingRequirements}
              onChange={(event) => update('brandingRequirements', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="presentation-notes">Anything else to include</Label>
            <Input
              id="presentation-notes"
              value={values.notes}
              onChange={(event) => update('notes', event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
      </IntakeSection>
    </div>
  );
}

export default function AgentIntakeDialog({ agent, open, onOpenChange }: AgentIntakeDialogProps) {
  const template = getAgentIntakeTemplate(agent);
  const startAgentChat = useStartAgentChat();
  const [worksheetValues, setWorksheetValues] = useState(createWorksheetIntakeValues);
  const [assessmentValues, setAssessmentValues] = useState(createAssessmentIntakeValues);
  const [presentationValues, setPresentationValues] = useState(createPresentationIntakeValues);
  const [validationMessage, setValidationMessage] = useState('');

  useEffect(() => {
    if (open) {
      setWorksheetValues(createWorksheetIntakeValues());
      setAssessmentValues(createAssessmentIntakeValues());
      setPresentationValues(createPresentationIntakeValues());
      setValidationMessage('');
    }
  }, [agent?.id, open, template]);

  if (!agent || !template) {
    return null;
  }

  const dialogCopy = {
    worksheet: {
      title: 'Create worksheet',
      description:
        'Share the skill your students should practice. Choose the options you need, then add any must-have details below.',
      submitLabel: 'Create worksheet',
    },
    assessment: {
      title: 'Create assessment',
      description:
        'Share what you want to assess. Set the format and difficulty, then choose multiple versions only when you need them.',
      submitLabel: 'Create assessment',
    },
    presentation: {
      title: 'Plan presentation',
      description:
        'Choose an approved template style and share the presentation details. The agent will draft the slide content for review before creating the PPTX.',
      submitLabel: 'Draft for review',
    },
  }[template];
  const { title, description, submitLabel } = dialogCopy;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    let prompt = '';

    if (template === 'worksheet') {
      const grade =
        worksheetValues.grade === 'Other' ? worksheetValues.customGrade : worksheetValues.grade;
      if (!worksheetValues.topic.trim() || !grade.trim()) {
        setValidationMessage('Enter a topic and grade or age to continue.');
        return;
      }
      prompt = buildWorksheetIntakePrompt(worksheetValues);
    } else if (template === 'assessment') {
      const grade =
        assessmentValues.grade === 'Other' ? assessmentValues.customGrade : assessmentValues.grade;
      if (!assessmentValues.topic.trim() || !grade.trim()) {
        setValidationMessage('Enter a topic and grade or age to continue.');
        return;
      }
      prompt = buildAssessmentIntakePrompt(assessmentValues);
    } else {
      if (!presentationValues.titleOrTopic.trim() || !presentationValues.audience.trim()) {
        setValidationMessage('Enter a presentation topic and audience to continue.');
        return;
      }
      prompt = buildPresentationIntakePrompt(presentationValues);
    }

    onOpenChange(false);
    startAgentChat(agent, prompt);
  };

  let formFields: React.ReactNode;
  if (template === 'worksheet') {
    formFields = <WorksheetFields values={worksheetValues} setValues={setWorksheetValues} />;
  } else if (template === 'assessment') {
    formFields = <AssessmentFields values={assessmentValues} setValues={setAssessmentValues} />;
  } else {
    formFields = (
      <PresentationFields values={presentationValues} setValues={setPresentationValues} />
    );
  }

  return (
    <OGDialog open={open} onOpenChange={onOpenChange} modal>
      <OGDialogContent className="max-h-[90vh] w-[min(96vw,62rem)] overflow-y-auto p-0">
        <form onSubmit={submit}>
          <OGDialogHeader className="border-b border-border-light bg-surface-primary px-6 py-5">
            <OGDialogTitle>{title}</OGDialogTitle>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{description}</p>
          </OGDialogHeader>
          <div className="bg-surface-secondary/30 px-6 py-5">
            {formFields}
            {validationMessage ? (
              <p className="mt-4 text-sm text-red-600" role="alert">
                {validationMessage}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-3 border-t border-border-light px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className={cn('min-w-36 justify-center')}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </OGDialogContent>
    </OGDialog>
  );
}
