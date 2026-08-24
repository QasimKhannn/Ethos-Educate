/* eslint-disable i18next/no-literal-string */

import React, { useEffect, useState } from 'react';
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
  buildWorksheetIntakePrompt,
  createAssessmentIntakeValues,
  createWorksheetIntakeValues,
  getAgentIntakeTemplate,
  gradeOptions,
  versionMethods,
  worksheetQuestionTypes,
  type AssessmentIntakeValues,
  type WorksheetIntakeValues,
} from './agentIntake';

interface AgentIntakeDialogProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const inputClass =
  'h-10 w-full rounded-md border border-border-light bg-surface-secondary px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary';
const textareaClass =
  'w-full rounded-md border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary';

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
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-text-primary">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {choices.map((choice) => {
          const id = `${label}-${choice}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
          const checked = selected.includes(choice);

          return (
            <Label
              key={choice}
              htmlFor={id}
              className="flex items-center gap-2 text-sm font-normal"
            >
              <Checkbox
                id={id}
                checked={checked}
                aria-label={choice}
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
      <Label htmlFor="agent-intake-grade">Grade / age</Label>
      <select
        id="agent-intake-grade"
        className={inputClass}
        value={grade}
        onChange={(event) => onGradeChange(event.target.value)}
      >
        <option value="">Select grade / age</option>
        {gradeOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
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
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="worksheet-difficulty">Difficulty level</Label>
          <select
            id="worksheet-difficulty"
            className={inputClass}
            value={values.difficulty}
            onChange={(event) => update('difficulty', event.target.value)}
          >
            <option>Easy</option>
            <option>Grade-level</option>
            <option>Challenging</option>
            <option>Mixed</option>
            <option>Other</option>
          </select>
          {values.difficulty === 'Other' ? (
            <Input
              value={values.otherDifficulty}
              onChange={(event) => update('otherDifficulty', event.target.value)}
              placeholder="Describe the difficulty"
              aria-label="Other difficulty level"
            />
          ) : null}
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">Include an answer key?</legend>
        <div className="flex gap-5">
          {[
            ['yes', 'Yes'],
            ['no', 'No'],
          ].map(([value, label]) => (
            <Label key={value} className="flex items-center gap-2 text-sm font-normal">
              <input
                type="radio"
                name="worksheet-answer-key"
                value={value}
                checked={values.includeAnswerKey === value}
                onChange={() => update('includeAnswerKey', value as 'yes' | 'no')}
              />
              {label}
            </Label>
          ))}
        </div>
      </fieldset>
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
        <div className="space-y-2">
          <Label htmlFor="assessment-type">Assessment type</Label>
          <select
            id="assessment-type"
            className={inputClass}
            value={values.assessmentType}
            onChange={(event) => update('assessmentType', event.target.value)}
          >
            <option>Quiz</option>
            <option>Test</option>
            <option>Checkpoint</option>
            <option>Benchmark</option>
          </select>
        </div>
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
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="assessment-version-count">How many versions?</Label>
          <select
            id="assessment-version-count"
            className={inputClass}
            value={values.versionCount}
            onChange={(event) => update('versionCount', event.target.value)}
          >
            {[1, 2, 3, 4, 5].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="assessment-answer-keys">Answer keys</Label>
          <select
            id="assessment-answer-keys"
            className={inputClass}
            value={values.answerKeyMode}
            onChange={(event) => update('answerKeyMode', event.target.value)}
          >
            <option>One answer key for each version</option>
            <option>Combined answer key</option>
            <option>No answer key</option>
          </select>
        </div>
      </div>
      {showVersionOptions ? (
        <div className="space-y-5 border-t border-border-light pt-5">
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
            <div className="space-y-2">
              <Label htmlFor="assessment-equivalent-difficulty">Keep difficulty equivalent?</Label>
              <select
                id="assessment-equivalent-difficulty"
                className={inputClass}
                value={values.equivalentDifficulty}
                onChange={(event) => update('equivalentDifficulty', event.target.value)}
              >
                <option>Yes</option>
                <option>No</option>
                <option>Let the agent decide</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessment-shared-objectives">
                Keep learning objectives the same?
              </Label>
              <select
                id="assessment-shared-objectives"
                className={inputClass}
                value={values.sharedObjectives}
                onChange={(event) => update('sharedObjectives', event.target.value)}
              >
                <option>Yes</option>
                <option>No</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assessment-version-labels">Version labels</Label>
              <select
                id="assessment-version-labels"
                className={inputClass}
                value={values.versionLabels}
                onChange={(event) => update('versionLabels', event.target.value)}
              >
                <option>Version A, B, C, D, E</option>
                <option>Version 1, 2, 3, 4, 5</option>
                <option>Custom</option>
              </select>
            </div>
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
    </div>
  );
}

export default function AgentIntakeDialog({ agent, open, onOpenChange }: AgentIntakeDialogProps) {
  const template = getAgentIntakeTemplate(agent);
  const startAgentChat = useStartAgentChat();
  const [worksheetValues, setWorksheetValues] = useState(createWorksheetIntakeValues);
  const [assessmentValues, setAssessmentValues] = useState(createAssessmentIntakeValues);
  const [validationMessage, setValidationMessage] = useState('');

  useEffect(() => {
    if (open) {
      setWorksheetValues(createWorksheetIntakeValues());
      setAssessmentValues(createAssessmentIntakeValues());
      setValidationMessage('');
    }
  }, [agent?.id, open, template]);

  if (!agent || !template) {
    return null;
  }

  const values = template === 'worksheet' ? worksheetValues : assessmentValues;
  const grade = values.grade === 'Other' ? values.customGrade : values.grade;
  const title = template === 'worksheet' ? 'Create worksheet' : 'Create assessment';
  const description =
    template === 'worksheet'
      ? 'Share the skill your students should practice. Choose the options you need, then add any must-have details below.'
      : 'Share what you want to assess. Set the format and difficulty, then choose multiple versions only when you need them.';

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!values.topic.trim() || !grade.trim()) {
      setValidationMessage('Enter a topic and grade or age to continue.');
      return;
    }

    const prompt =
      template === 'worksheet'
        ? buildWorksheetIntakePrompt(worksheetValues)
        : buildAssessmentIntakePrompt(assessmentValues);

    onOpenChange(false);
    startAgentChat(agent, prompt);
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange} modal>
      <OGDialogContent className="max-h-[90vh] w-[min(96vw,58rem)] overflow-y-auto p-0">
        <form onSubmit={submit}>
          <OGDialogHeader className="border-b border-border-light px-6 py-5">
            <OGDialogTitle>{title}</OGDialogTitle>
          </OGDialogHeader>
          <div className="px-6 py-5">
            <p className="mb-5 text-sm leading-6 text-text-secondary">{description}</p>
            {template === 'worksheet' ? (
              <WorksheetFields values={worksheetValues} setValues={setWorksheetValues} />
            ) : (
              <AssessmentFields values={assessmentValues} setValues={setAssessmentValues} />
            )}
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
              {title}
            </Button>
          </div>
        </form>
      </OGDialogContent>
    </OGDialog>
  );
}
