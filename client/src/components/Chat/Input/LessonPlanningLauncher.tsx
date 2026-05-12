/* eslint-disable i18next/no-literal-string */

import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
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
import { useHasAccess, useSubmitMessage } from '~/hooks';
import { useBadgeRowContext, useAgentsMapContext } from '~/Providers';
import { useGetAgentByIdQuery } from '~/data-provider';
import { cn } from '~/utils';
import {
  LESSON_PLANNING_DURATION_OPTIONS,
  LESSON_PLANNING_FRAMEWORK_OPTIONS,
  LESSON_PLANNING_GRADE_OPTIONS,
  LESSON_PLANNING_SERVER_NAME,
  LESSON_PLANNING_STATE_OPTIONS,
  LESSON_PLANNING_SUBJECT_OPTIONS,
  agentHasLessonPlanningMcp,
  buildLessonPlanningLaunchPrompt,
  defaultLessonPlanningLaunchForm,
  isLessonPlanningServerName,
  type LessonPlanningLaunchForm,
  type LessonPlanningOption,
} from './lessonPlanningUtils';

interface LessonPlanningLauncherProps {
  agentId?: string | null;
  isAgentConversation?: boolean;
}

interface LessonPlanningDropdownProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: LessonPlanningOption[];
  isOpen: boolean;
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
}

function LessonPlanningDropdown({
  id,
  label,
  value,
  placeholder,
  options,
  isOpen,
  disabled = false,
  className,
  onChange,
  onOpenChange,
}: LessonPlanningDropdownProps) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? placeholder;

  return (
    <div className={cn('relative space-y-1.5', className)}>
      <Label id={`${id}-label`}>{label}</Label>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${id}-label ${id}`}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) {
            return;
          }
          onOpenChange(!isOpen);
        }}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-border-medium bg-transparent px-3 py-2 text-left text-sm',
          'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-60',
          value ? 'text-text-primary' : 'text-text-secondary',
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {isOpen && (
        <div
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute left-0 right-0 top-full z-[220] mt-1 max-h-56 overflow-y-auto rounded-md border border-border-medium bg-surface-primary p-1 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="option"
            aria-selected={value === ''}
            className={cn(
              'w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-secondary',
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
                'w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-secondary',
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

function LessonPlanningLauncher({
  agentId,
  isAgentConversation = false,
}: LessonPlanningLauncherProps) {
  const { submitMessage } = useSubmitMessage();
  const canUseMcp = useHasAccess({
    permissionType: PermissionTypes.MCP_SERVERS,
    permission: Permissions.USE,
  });
  const { mcpServerManager } = useBadgeRowContext();
  const { availableMCPServers, mcpValues, setMCPValues, isInitializing } = mcpServerManager;
  const agentsMap = useAgentsMapContext();

  const [isOpen, setIsOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<LessonPlanningLaunchForm>(
    defaultLessonPlanningLaunchForm(),
  );
  const previousServerSelectionRef = useRef<string[]>([]);

  const lessonPlanningServer = useMemo(
    () =>
      availableMCPServers.find((server) => isLessonPlanningServerName(server.serverName)) ?? null,
    [availableMCPServers],
  );

  const lessonPlanningServerName = lessonPlanningServer?.serverName ?? LESSON_PLANNING_SERVER_NAME;
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
  const hasLessonPlanningMcp = useMemo(
    () =>
      isAgentConversation === true &&
      Boolean(agentId) &&
      agentHasLessonPlanningMcp(activeAgentTools, lessonPlanningServerName),
    [activeAgentTools, agentId, isAgentConversation, lessonPlanningServerName],
  );
  const isActive = useMemo(
    () => (mcpValues ?? []).some((serverName) => isLessonPlanningServerName(serverName)),
    [mcpValues],
  );

  const handleFieldChange = useCallback(
    (field: keyof LessonPlanningLaunchForm) =>
      (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        setFormValues((current) => ({ ...current, [field]: value }));
      },
    [],
  );

  const handleDropdownChange = useCallback(
    (field: keyof LessonPlanningLaunchForm) => (value: string) => {
      setFormValues((current) => ({ ...current, [field]: value }));
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

  const handleOpenChange = useCallback((open: boolean) => {
    setOpenDropdown(null);
    setIsOpen(open);
  }, []);

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

  const handleLaunch = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const currentValues = mcpValues ?? [];
      previousServerSelectionRef.current = currentValues.filter(
        (serverName) => !isLessonPlanningServerName(serverName),
      );

      setMCPValues([lessonPlanningServerName]);
      submitMessage({
        text: buildLessonPlanningLaunchPrompt(formValues),
      });
      setIsOpen(false);
    },
    [formValues, lessonPlanningServerName, mcpValues, setMCPValues, submitMessage],
  );

  if (
    !canUseMcp ||
    !isAgentConversation ||
    !agentId ||
    !hasLessonPlanningMcp ||
    lessonPlanningServer == null
  ) {
    return null;
  }

  const isServerBusy = isInitializing(lessonPlanningServerName);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
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
          className="max-h-[90vh] w-11/12 max-w-2xl overflow-y-auto"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <OGDialogHeader>
            <OGDialogTitle className="text-xl">Lesson Planning</OGDialogTitle>
          </OGDialogHeader>
          <form onSubmit={handleLaunch} className="space-y-5">
            <div className="rounded-2xl border border-border-medium bg-surface-secondary p-4 text-sm text-text-secondary">
              This launcher switches the current chat to the lesson-planning MCP only. Any details
              you enter below will be used to kick off the guided workflow in chat and will still be
              validated against the lesson-planning options.
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <LessonPlanningDropdown
                id="lesson-planning-state"
                label="State"
                value={formValues.state}
                placeholder="Ask me later"
                options={LESSON_PLANNING_STATE_OPTIONS.map((state) => ({
                  value: state,
                  label: state,
                }))}
                isOpen={openDropdown === 'state'}
                onChange={handleDropdownChange('state')}
                onOpenChange={(open) => setOpenDropdown(open ? 'state' : null)}
              />
              <div className="space-y-2">
                <Label id="lesson-planning-frameworks-label">School frameworks</Label>
                <div
                  id="lesson-planning-frameworks"
                  role="group"
                  aria-labelledby="lesson-planning-frameworks-label"
                  className="grid grid-cols-2 gap-2 rounded-md border border-border-medium p-3"
                >
                  {LESSON_PLANNING_FRAMEWORK_OPTIONS.map((framework) => (
                    <label
                      key={framework}
                      className="flex cursor-pointer items-center gap-2 text-sm text-text-primary"
                    >
                      <Checkbox
                        aria-label={`Select ${framework} framework`}
                        checked={formValues.frameworks.includes(framework)}
                        onCheckedChange={(checked) =>
                          handleFrameworkToggle(framework, checked === true)
                        }
                      />
                      <span>{framework}</span>
                    </label>
                  ))}
                </div>
              </div>
              <LessonPlanningDropdown
                id="lesson-planning-subject"
                label="Subject"
                value={formValues.subject}
                placeholder="Ask me later"
                options={LESSON_PLANNING_SUBJECT_OPTIONS.map((subject) => ({
                  value: subject,
                  label: subject,
                }))}
                isOpen={openDropdown === 'subject'}
                onChange={handleDropdownChange('subject')}
                onOpenChange={(open) => setOpenDropdown(open ? 'subject' : null)}
              />
              <LessonPlanningDropdown
                id="lesson-planning-grade"
                label="Grade or course"
                value={formValues.gradeLevel}
                placeholder="Ask me later"
                options={LESSON_PLANNING_GRADE_OPTIONS}
                isOpen={openDropdown === 'grade'}
                onChange={handleDropdownChange('gradeLevel')}
                onOpenChange={(open) => setOpenDropdown(open ? 'grade' : null)}
              />
              <div className="rounded-md border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-secondary md:col-span-2">
                Unit selection happens next in chat. The lesson-planning MCP will call
                lesson_get_units from the validated state, subject, and grade, then ask the teacher
                to pick from those returned units.
              </div>
              <LessonPlanningDropdown
                id="lesson-planning-duration"
                label="Preferred lesson duration"
                value={formValues.lessonDuration}
                placeholder="Ask me later in the workflow"
                options={LESSON_PLANNING_DURATION_OPTIONS}
                isOpen={openDropdown === 'duration'}
                className="md:col-span-2"
                onChange={handleDropdownChange('lessonDuration')}
                onOpenChange={(open) => setOpenDropdown(open ? 'duration' : null)}
              />
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="lesson-planning-notes">Teacher notes</Label>
                <Textarea
                  id="lesson-planning-notes"
                  placeholder="Add any goals, accommodations, or context you want included."
                  value={formValues.teacherNotes}
                  onChange={handleFieldChange('teacherNotes')}
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-3 border-t border-border-light pt-4">
              <div className="text-xs text-text-secondary">
                {isActive
                  ? 'Lesson planning is currently active in this conversation.'
                  : 'This stays isolated to the lesson-planning MCP only.'}
              </div>
              <div className="flex flex-wrap gap-2">
                {isActive && (
                  <Button type="button" variant="outline" onClick={handleDisable}>
                    Turn off lesson planning
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="submit" disabled={isServerBusy}>
                  Start workflow
                </Button>
              </div>
            </div>
          </form>
        </OGDialogContent>
      </OGDialog>
    </>
  );
}

export default memo(LessonPlanningLauncher);
