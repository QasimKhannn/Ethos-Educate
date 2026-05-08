import { useState } from 'react';
import { FolderPlus, Lightbulb, Sparkles, X } from 'lucide-react';
import { Button, Input, OGDialog, OGDialogContent, useToastContext } from '@librechat/client';
import type { FormEvent } from 'react';
import type { TProject } from 'librechat-data-provider';
import { useCreateProjectMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';

type ProjectCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: TProject) => void;
};

export default function ProjectCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: ProjectCreateDialogProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [name, setName] = useState('');
  const createProject = useCreateProjectMutation({
    onSuccess: (project) => {
      setName('');
      onOpenChange(false);
      onCreated?.(project);
    },
    onError: () => {
      showToast({
        message: localize('com_projects_create_failed'),
        status: 'error',
      });
    },
  });

  const trimmedName = name.trim();
  const isDisabled = !trimmedName || createProject.isLoading;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isDisabled) {
      return;
    }
    createProject.mutate({ name: trimmedName });
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent
        showCloseButton={false}
        className="w-11/12 max-w-[640px] rounded-2xl border border-border-light bg-surface-primary p-0 text-text-primary shadow-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-medium">{localize('com_projects_create_project')}</h2>
            <button
              type="button"
              className="rounded-full p-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              aria-label={localize('com_ui_close')}
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <label className="block space-y-3">
            <span className="text-base font-medium">{localize('com_projects_project_name')}</span>
            <div className="relative">
              <Sparkles className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary" />
              <Input
                autoFocus
                value={name}
                maxLength={128}
                className="h-12 rounded-xl border-border-light bg-surface-primary pl-12 text-base"
                placeholder={localize('com_projects_project_name_placeholder')}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </label>

          <div className="flex gap-4 rounded-2xl bg-surface-hover p-5 text-sm leading-6 text-text-primary">
            <Lightbulb className="mt-1 h-6 w-6 flex-shrink-0" />
            <p>{localize('com_projects_create_description')}</p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isDisabled} className="rounded-full px-6">
              <FolderPlus className="mr-2 h-4 w-4" />
              {localize('com_projects_create_project')}
            </Button>
          </div>
        </form>
      </OGDialogContent>
    </OGDialog>
  );
}
