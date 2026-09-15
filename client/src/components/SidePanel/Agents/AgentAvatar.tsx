import { memo, useCallback, useEffect, useRef } from 'react';
import { useToastContext } from '@librechat/client';
import { useFormContext, useWatch } from 'react-hook-form';
import { mergeFileConfig, fileConfig as defaultFileConfig } from 'librechat-data-provider';
import type { AgentAvatar } from 'librechat-data-provider';
import type { AgentForm } from '~/common';
import { AgentAvatarRender, NoImage } from './Images';
import { useGetFileConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';

function Avatar({ avatar }: { avatar: AgentAvatar | null }) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { control, setValue } = useFormContext<AgentForm>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarPreview = useWatch({ control, name: 'avatar_preview' }) ?? '';
  const avatarAction = useWatch({ control, name: 'avatar_action' });
  const { data: fileConfig = defaultFileConfig } = useGetFileConfig({
    select: (data) => mergeFileConfig(data),
  });

  // Derive whether agent has a remote avatar from the avatar prop
  const hasRemoteAvatar = Boolean(avatar?.filepath);

  useEffect(() => {
    if (avatarAction) {
      return;
    }

    if (avatar?.filepath && avatarPreview !== avatar.filepath) {
      setValue('avatar_preview', avatar.filepath);
    }

    if (!avatar?.filepath && avatarPreview !== '') {
      setValue('avatar_preview', '');
    }
  }, [avatar?.filepath, avatarAction, avatarPreview, setValue]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const sizeLimit = fileConfig.avatarSizeLimit ?? 0;

      if (!file) {
        return;
      }

      if (sizeLimit && file.size > sizeLimit) {
        const limitInMb = sizeLimit / (1024 * 1024);
        const displayLimit = Number.isInteger(limitInMb)
          ? limitInMb
          : parseFloat(limitInMb.toFixed(1));
        showToast({
          message: localize('com_ui_upload_invalid_var', { 0: displayLimit }),
          status: 'error',
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setValue('avatar_file', file, { shouldDirty: true });
        setValue('avatar_preview', (reader.result as string) ?? '', { shouldDirty: true });
        setValue('avatar_action', 'upload', { shouldDirty: true });
      };
      reader.readAsDataURL(file);
    },
    [fileConfig.avatarSizeLimit, localize, setValue, showToast],
  );

  const handleReset = useCallback(() => {
    const remoteAvatarExists = Boolean(avatar?.filepath);
    setValue('avatar_preview', '', { shouldDirty: true });
    setValue('avatar_file', null, { shouldDirty: true });
    setValue('avatar_action', remoteAvatarExists ? 'reset' : null, { shouldDirty: true });
  }, [avatar?.filepath, setValue]);

  const handleUploadClick = useCallback(() => {
    const input = fileInputRef.current;
    if (!input) {
      return;
    }

    input.value = '';
    input.click();
  }, []);

  const hasIcon = Boolean(avatarPreview) || hasRemoteAvatar;
  const canReset = hasIcon;

  return (
    <>
      <div className="agent-builder-avatar-control flex w-full flex-col items-center gap-1">
        <button
          type="button"
          className="h-20 w-20 outline-none ring-offset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={localize('com_ui_upload_agent_avatar_label')}
          onClick={handleUploadClick}
        >
          {avatarPreview ? <AgentAvatarRender url={avatarPreview} /> : <NoImage />}
        </button>
        {canReset && (
          <button
            type="button"
            className="text-xs text-text-secondary underline-offset-2 hover:text-text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={handleReset}
          >
            {localize('com_ui_reset')}
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        accept="image/png,.png,image/jpeg,.jpg,.jpeg,image/gif,.gif,image/webp,.webp"
        className="sr-only"
        type="file"
        onChange={handleFileChange}
        tabIndex={-1}
      />
    </>
  );
}

const MemoizedAvatar = memo(
  Avatar,
  (prevProps, nextProps) => prevProps.avatar?.filepath === nextProps.avatar?.filepath,
);
MemoizedAvatar.displayName = 'Avatar';

export default MemoizedAvatar;
