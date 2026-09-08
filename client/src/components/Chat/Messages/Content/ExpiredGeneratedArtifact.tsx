import { Button } from '@librechat/client';
import { FileClock, ImageOff, RefreshCw } from 'lucide-react';
import { useLocalize } from '~/hooks';
import { useMessageContext } from '~/Providers';
import { cn } from '~/utils';

type GeneratedArtifactType = 'document' | 'image';

type ExpiredGeneratedArtifactProps = {
  artifactType: GeneratedArtifactType;
  count?: number;
  inline?: boolean;
};

const ExpiredGeneratedArtifact = ({
  artifactType,
  count = 1,
  inline = false,
}: ExpiredGeneratedArtifactProps) => {
  const localize = useLocalize();
  const { onRegenerate, isRegenerating = false } = useMessageContext();
  const isImage = artifactType === 'image';
  const hasMultipleFiles = !isImage && count > 1;
  const Icon = isImage ? ImageOff : FileClock;
  let descriptionKey = 'com_ui_generated_file_expired_description';
  if (isImage) {
    descriptionKey = 'com_ui_generated_image_expired_description';
  } else if (hasMultipleFiles) {
    descriptionKey = 'com_ui_generated_files_expired_description';
  }
  const description = localize(descriptionKey);
  const actionKey = isImage
    ? 'com_ui_generated_image_expired_action'
    : 'com_ui_generated_file_expired_action';

  const className = cn(
    'not-prose max-w-md items-start gap-3 rounded-xl border border-border-light bg-surface-secondary px-3 py-3 text-sm shadow-sm',
    inline ? 'my-2 inline-flex align-middle' : 'my-3 flex w-full',
  );

  const content = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-light bg-surface-primary text-text-secondary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block leading-5 text-text-secondary">{description}</span>
        {onRegenerate != null && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isRegenerating}
            onClick={onRegenerate}
            className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium"
          >
            <RefreshCw
              className={cn('size-3.5', isRegenerating && 'animate-spin')}
              aria-hidden="true"
            />
            {localize(isRegenerating ? 'com_ui_regenerating' : actionKey)}
          </Button>
        )}
      </span>
    </>
  );

  return inline ? (
    <span role="status" className={className}>
      {content}
    </span>
  ) : (
    <div role="status" className={className}>
      {content}
    </div>
  );
};

export default ExpiredGeneratedArtifact;
