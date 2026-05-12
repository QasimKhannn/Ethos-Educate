/* eslint-disable i18next/no-literal-string */

import { memo, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Button, Checkbox, Label } from '@librechat/client';
import { Constants, ContentTypes } from 'librechat-data-provider';
import type { TMessageContentParts } from 'librechat-data-provider';
import { useSubmitMessage } from '~/hooks';
import { cn } from '~/utils';

const LESSON_PLANNING_SERVER_NAME = 'lesson-planning';
const LESSON_GET_UNITS_TOOL_NAME = 'lesson_get_units';
const LESSON_GENERATE_SUGGESTIONS_TOOL_NAME = 'lesson_generate_suggestions';

interface LessonPlanningChoice {
  label: string;
  value: string;
  description?: string;
}

interface LessonPlanningSuggestionChoices {
  benchmarks: LessonPlanningChoice[];
  strategies: LessonPlanningChoice[];
}

function parseJsonOnce(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function unwrapToolOutput(output: unknown): unknown {
  let current = output;

  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current === 'string') {
      const parsed = parseJsonOnce(current);
      if (parsed === current) {
        return current;
      }
      current = parsed;
      continue;
    }

    if (Array.isArray(current)) {
      const textContent = current.find(
        (item) => item && typeof item === 'object' && 'text' in item,
      ) as { text?: unknown } | undefined;

      if (typeof textContent?.text === 'string') {
        current = textContent.text;
        continue;
      }

      return current;
    }

    if (current && typeof current === 'object' && 'text' in current) {
      const text = (current as { text?: unknown }).text;
      if (typeof text === 'string') {
        current = text;
        continue;
      }
    }

    return current;
  }

  return current;
}

function getToolCallName(toolCall: unknown): string {
  if (!toolCall || typeof toolCall !== 'object') {
    return '';
  }

  const namedTool = toolCall as {
    name?: unknown;
    function?: { name?: unknown };
  };

  if (typeof namedTool.name === 'string') {
    return namedTool.name;
  }

  if (typeof namedTool.function?.name === 'string') {
    return namedTool.function.name;
  }

  return '';
}

function getToolCallOutput(toolCall: unknown): unknown {
  if (!toolCall || typeof toolCall !== 'object') {
    return undefined;
  }

  const outputTool = toolCall as {
    output?: unknown;
    function?: { output?: unknown };
  };

  return outputTool.output ?? outputTool.function?.output;
}

function isLessonPlanningTool(name: string, expectedToolName: string): boolean {
  const delimiter = Constants.mcp_delimiter;
  if (!name.includes(delimiter)) {
    return false;
  }

  const [toolName, serverName] = name.split(delimiter);

  return (
    toolName === expectedToolName &&
    serverName?.trim().toLowerCase() === LESSON_PLANNING_SERVER_NAME
  );
}

function textFromContent(content: Array<TMessageContentParts | undefined>): string {
  return content
    .map((part) => {
      if (!part || part.type !== ContentTypes.TEXT) {
        return '';
      }

      const text = typeof part.text === 'string' ? part.text : part.text?.value;
      return typeof text === 'string' ? text : '';
    })
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

export function getLessonPlanningUnitChoices(
  content: Array<TMessageContentParts | undefined>,
): LessonPlanningChoice[] {
  const promptText = textFromContent(content);
  if (!promptText.includes('unit') || !promptText.includes('choose')) {
    return [];
  }

  const unitPayloads = content
    .map((part) => {
      if (!part || part.type !== ContentTypes.TOOL_CALL) {
        return undefined;
      }

      const toolCall = part[ContentTypes.TOOL_CALL];
      const name = getToolCallName(toolCall);

      if (!isLessonPlanningTool(name, LESSON_GET_UNITS_TOOL_NAME)) {
        return undefined;
      }

      return unwrapToolOutput(getToolCallOutput(toolCall));
    })
    .filter((payload) => Array.isArray(payload));

  const latestPayload = unitPayloads.at(-1);
  if (!Array.isArray(latestPayload)) {
    return [];
  }

  return latestPayload
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as Record<string, unknown>;
      const label = typeof record.label === 'string' ? record.label : '';
      const value = typeof record.value === 'string' ? record.value : label;

      return label ? { label, value } : null;
    })
    .filter((choice): choice is LessonPlanningChoice => choice != null);
}

function choiceFromRecord(item: unknown): LessonPlanningChoice | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const record = item as Record<string, unknown>;
  let label = '';
  if (typeof record.label === 'string') {
    label = record.label;
  } else if (typeof record.title === 'string') {
    label = record.title;
  }

  if (!label) {
    return null;
  }

  const value = typeof record.value === 'string' ? record.value : label;
  const description = typeof record.description === 'string' ? record.description : undefined;

  return { label, value, description };
}

function choicesFromUnknown(value: unknown): LessonPlanningChoice[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(choiceFromRecord)
    .filter((choice): choice is LessonPlanningChoice => choice != null);
}

export function getLessonPlanningSuggestionChoices(
  content: Array<TMessageContentParts | undefined>,
): LessonPlanningSuggestionChoices | null {
  const promptText = textFromContent(content);
  if (!promptText.includes('benchmark') || !promptText.includes('strateg')) {
    return null;
  }

  const suggestionPayloads = content
    .map((part) => {
      if (!part || part.type !== ContentTypes.TOOL_CALL) {
        return undefined;
      }

      const toolCall = part[ContentTypes.TOOL_CALL];
      const name = getToolCallName(toolCall);

      if (!isLessonPlanningTool(name, LESSON_GENERATE_SUGGESTIONS_TOOL_NAME)) {
        return undefined;
      }

      return unwrapToolOutput(getToolCallOutput(toolCall));
    })
    .filter((payload) => payload && typeof payload === 'object' && !Array.isArray(payload));

  const latestPayload = suggestionPayloads.at(-1);
  if (!latestPayload || typeof latestPayload !== 'object' || Array.isArray(latestPayload)) {
    return null;
  }

  const record = latestPayload as Record<string, unknown>;
  const benchmarks = choicesFromUnknown(record.benchmarks);
  const strategies = choicesFromUnknown(record.engagement_strategies);

  if (benchmarks.length === 0 && strategies.length === 0) {
    return null;
  }

  return { benchmarks, strategies };
}

function SelectionRow({
  choice,
  checked,
  onCheckedChange,
}: {
  choice: LessonPlanningChoice;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Label
      className={cn(
        'flex cursor-pointer gap-3 rounded-xl border px-3 py-2 text-sm transition-colors',
        checked
          ? 'border-sky-500/50 bg-sky-500/10'
          : 'border-border-light bg-surface-primary hover:bg-surface-secondary',
      )}
    >
      <Checkbox
        aria-label={`Select ${choice.label}`}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <span className="space-y-1">
        <span className="block font-medium text-text-primary">{choice.label}</span>
        {choice.description && choice.description !== choice.label && (
          <span className="block text-xs text-text-secondary">{choice.description}</span>
        )}
      </span>
    </Label>
  );
}

function LessonPlanningUnitChoices({
  content,
  isSubmitting,
}: {
  content: Array<TMessageContentParts | undefined>;
  isSubmitting: boolean;
}) {
  const { submitMessage } = useSubmitMessage();
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>([]);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const unitChoices = useMemo(() => getLessonPlanningUnitChoices(content), [content]);
  const suggestionChoices = useMemo(() => getLessonPlanningSuggestionChoices(content), [content]);

  useEffect(() => {
    setSelectedBenchmarks([]);
    setSelectedStrategies([]);
  }, [content]);

  if (isSubmitting) {
    return null;
  }

  if (suggestionChoices) {
    const selectedBenchmarkChoices = suggestionChoices.benchmarks.filter((choice) =>
      selectedBenchmarks.includes(choice.value),
    );
    const selectedStrategyChoices = suggestionChoices.strategies.filter((choice) =>
      selectedStrategies.includes(choice.value),
    );
    const hasRequiredBenchmarks =
      suggestionChoices.benchmarks.length === 0 || selectedBenchmarkChoices.length > 0;
    const hasRequiredStrategies =
      suggestionChoices.strategies.length === 0 || selectedStrategyChoices.length > 0;

    const toggleSelection = (
      choice: LessonPlanningChoice,
      checked: boolean,
      setSelected: Dispatch<SetStateAction<string[]>>,
    ) => {
      setSelected((current) =>
        checked
          ? [...current, choice.value]
          : current.filter((selectedValue) => selectedValue !== choice.value),
      );
    };

    const continueWithSelections = () => {
      const benchmarkText = selectedBenchmarkChoices.map((choice) => choice.label).join('; ');
      const strategyText = selectedStrategyChoices.map((choice) => choice.label).join('; ');
      const lines: string[] = [];

      if (benchmarkText) {
        lines.push(`Benchmarks: ${benchmarkText}`);
      }
      if (strategyText) {
        lines.push(`Engagement strategies: ${strategyText}`);
      }

      submitMessage({ text: lines.join('\n') });
    };

    return (
      <div className="mt-3 space-y-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3 shadow-sm">
        <div>
          <div className="text-sm font-semibold text-text-primary">Choose lesson options</div>
          <div className="text-xs text-text-secondary">
            Select the benchmark(s) and engagement strategy option(s) returned by the
            lesson-planning MCP.
          </div>
        </div>

        {suggestionChoices.benchmarks.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Benchmarks
            </div>
            <div className="grid gap-2">
              {suggestionChoices.benchmarks.map((choice) => (
                <SelectionRow
                  key={choice.value}
                  choice={choice}
                  checked={selectedBenchmarks.includes(choice.value)}
                  onCheckedChange={(checked) =>
                    toggleSelection(choice, checked, setSelectedBenchmarks)
                  }
                />
              ))}
            </div>
          </div>
        )}

        {suggestionChoices.strategies.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Engagement strategies
            </div>
            <div className="grid gap-2">
              {suggestionChoices.strategies.map((choice) => (
                <SelectionRow
                  key={choice.value}
                  choice={choice}
                  checked={selectedStrategies.includes(choice.value)}
                  onCheckedChange={(checked) =>
                    toggleSelection(choice, checked, setSelectedStrategies)
                  }
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            variant="submit"
            disabled={!hasRequiredBenchmarks || !hasRequiredStrategies}
            onClick={continueWithSelections}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  if (unitChoices.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3 shadow-sm">
      <div className="mb-3">
        <div className="text-sm font-semibold text-text-primary">Choose a unit</div>
        <div className="text-xs text-text-secondary">
          Select one of the units returned by the lesson-planning MCP.
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {unitChoices.map((choice) => (
          <Button
            key={choice.value}
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => submitMessage({ text: choice.label })}
          >
            {choice.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default memo(LessonPlanningUnitChoices);
