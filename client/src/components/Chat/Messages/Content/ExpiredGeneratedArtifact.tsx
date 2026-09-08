import { FileClock, ImageOff } from 'lucide-react';
import { useLocalize } from '~/hooks';
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
  const isImage = artifactType === 'image';
  const hasMultipleFiles = !isImage && count > 1;
  const Icon = isImage ? ImageOff : FileClock;
  const title = localize(
    isImage
      ? 'com_ui_generated_image_expired_title'
      : hasMultipleFiles
        ? 'com_ui_generated_files_expired_title'
        : 'com_ui_generated_file_expired_title',
  );
  const description = localize(
    isImage
      ? 'com_ui_generated_image_expired_description'
      : hasMultipleFiles
        ? 'com_ui_generated_files_expired_description'
        : 'com_ui_generated_file_expired_description',
  );

  const content = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border-light bg-surface-primary text-text-secondary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-text-primary">{title}</span>
        <span className="mt-0.5 block text-text-secondary">{description}</span>
      </span>
    </>
  );

  const className = cn(
    'not-prose max-w-md items-start gap-3 rounded-lg border border-border-light bg-surface-secondary px-3 py-3 text-sm shadow-sm',
    inline ? 'my-2 inline-flex align-middle' : 'my-3 flex w-full',
  );

  if (inline) {
    return (
      <span role="status" className={className}>
        {content}
      </span>
    );
  }

  return (
    <div role="status" className={className}>
      {content}
    </div>
  );
};

export default ExpiredGeneratedArtifact;
