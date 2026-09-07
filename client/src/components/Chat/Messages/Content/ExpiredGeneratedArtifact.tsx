import { FileClock, ImageOff } from 'lucide-react';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

type GeneratedArtifactType = 'document' | 'image';

type ExpiredGeneratedArtifactProps = {
  artifactType: GeneratedArtifactType;
  inline?: boolean;
};

const ExpiredGeneratedArtifact = ({
  artifactType,
  inline = false,
}: ExpiredGeneratedArtifactProps) => {
  const localize = useLocalize();
  const isImage = artifactType === 'image';
  const Icon = isImage ? ImageOff : FileClock;
  const title = localize(
    isImage ? 'com_ui_generated_image_expired_title' : 'com_ui_generated_file_expired_title',
  );
  const description = localize(
    isImage
      ? 'com_ui_generated_image_expired_description'
      : 'com_ui_generated_file_expired_description',
  );

  const content = (
    <>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block font-medium text-text-primary">{title}</span>
        <span className="block text-text-secondary">{description}</span>
      </span>
    </>
  );

  const className = cn(
    'not-prose max-w-md items-start gap-2 rounded-md border border-border-light bg-surface-primary px-3 py-2 text-sm',
    inline ? 'my-2 inline-flex align-middle' : 'my-3 flex',
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
