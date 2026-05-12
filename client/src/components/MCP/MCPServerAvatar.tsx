import { MCPIcon } from '@librechat/client';
import { getKnownMCPServerPresentation, normalizeMCPServerName } from './knownMCPServers';
import { cn } from '~/utils';

interface MCPServerAvatarProps {
  serverName: string;
  displayName: string;
  iconPath?: string | null;
  title?: string;
  decorative?: boolean;
  shape?: 'circle' | 'square';
  containerClassName?: string;
  iconClassName?: string;
  imageClassName?: string;
}

export default function MCPServerAvatar({
  serverName,
  displayName,
  iconPath,
  title,
  decorative = true,
  shape = 'square',
  containerClassName,
  iconClassName,
  imageClassName,
}: MCPServerAvatarProps) {
  const shapeClassName = shape === 'circle' ? 'rounded-full' : 'rounded-lg';
  const normalizedServerName = normalizeMCPServerName(serverName);
  const resolvedIconPath =
    iconPath?.trim() || getKnownMCPServerPresentation(normalizedServerName)?.iconPath;

  if (resolvedIconPath) {
    return (
      <img
        src={resolvedIconPath}
        alt={decorative ? '' : displayName}
        title={title}
        aria-hidden={decorative ? true : undefined}
        className={cn('object-contain', shapeClassName, imageClassName)}
      />
    );
  }

  return (
    <div
      title={title}
      aria-hidden={decorative ? true : undefined}
      className={cn(
        'flex items-center justify-center bg-surface-tertiary text-text-secondary',
        shapeClassName,
        containerClassName,
      )}
    >
      <MCPIcon aria-hidden="true" className={iconClassName} />
    </div>
  );
}
