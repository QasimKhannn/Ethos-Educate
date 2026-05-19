import React, { useState, useEffect } from 'react';
import { Feather } from 'lucide-react';
import { Skeleton } from '@librechat/client';
import type t from 'librechat-data-provider';

const loadedAgentAvatarUrls = new Set<string>();

/**
 * Extracts the avatar URL from an agent's avatar property
 * Handles both string and object formats
 */
export const getAgentAvatarUrl = (agent: t.Agent | null | undefined): string | null => {
  if (!agent?.avatar) {
    return null;
  }

  if (typeof agent.avatar === 'string') {
    return agent.avatar;
  }

  if (agent.avatar && typeof agent.avatar === 'object' && 'filepath' in agent.avatar) {
    return agent.avatar.filepath;
  }

  return null;
};

const LazyAgentAvatar = ({
  url,
  alt,
  imgClass,
  skeletonClass,
}: {
  url: string;
  alt: string;
  imgClass: string;
  skeletonClass: string;
}) => {
  const isStaticSvgAvatar = url.startsWith('/assets/agent-icons/') && url.endsWith('.svg');
  const [isLoaded, setIsLoaded] = useState(
    () => isStaticSvgAvatar || loadedAgentAvatarUrls.has(url),
  );

  useEffect(() => {
    setIsLoaded(isStaticSvgAvatar || loadedAgentAvatarUrls.has(url));
  }, [isStaticSvgAvatar, url]);

  return (
    <>
      <img
        src={url}
        alt={alt}
        className={imgClass}
        loading={isStaticSvgAvatar ? 'eager' : 'lazy'}
        onLoad={() => {
          loadedAgentAvatarUrls.add(url);
          setIsLoaded(true);
        }}
        onError={() => {
          loadedAgentAvatarUrls.delete(url);
          setIsLoaded(false);
        }}
        style={{
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out',
        }}
      />
      {!isLoaded && !isStaticSvgAvatar && <Skeleton className={skeletonClass} aria-hidden="true" />}
    </>
  );
};

/**
 * Renders an agent avatar with fallback to Bot icon
 * Consistent across all agent displays
 */
export const renderAgentAvatar = (
  agent: t.Agent | null | undefined,
  options: {
    size?: 'icon' | 'sm' | 'md' | 'lg' | 'xl' | 'fill';
    className?: string;
    showBorder?: boolean;
    fit?: 'auto' | 'contain' | 'cover';
    shape?: 'auto' | 'circle' | 'rounded';
    visualScale?: 'default' | 'contained' | 'prominent';
  } = {},
): React.ReactElement => {
  const {
    size = 'md',
    className = '',
    showBorder = true,
    fit = 'auto',
    shape = 'auto',
    visualScale = 'default',
  } = options;

  const avatarUrl = getAgentAvatarUrl(agent);
  const normalizedAvatarUrl = avatarUrl?.split('?')[0]?.toLowerCase() ?? '';
  const isVectorAvatar = normalizedAvatarUrl.endsWith('.svg');

  // Size mappings for responsive design
  const sizeClasses = {
    icon: 'h-5 w-5',
    sm: 'h-12 w-12 sm:h-14 sm:w-14',
    md: 'h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24',
    lg: 'h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28',
    xl: 'h-24 w-24',
    fill: 'h-full w-full',
  };

  const iconSizeClasses = {
    icon: 'h-4 w-4',
    sm: 'h-6 w-6 sm:h-7 sm:w-7',
    md: 'h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10',
    lg: 'h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12',
    xl: 'h-10 w-10',
    fill: 'h-10 w-10 sm:h-11 sm:w-11',
  };

  const placeholderSizeClasses = {
    icon: 'h-5 w-5',
    sm: 'h-10 w-10 sm:h-12 sm:w-12',
    md: 'h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20',
    lg: 'h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24',
    xl: 'h-20 w-20',
    fill: 'h-full w-full',
  };

  const borderClasses = showBorder ? 'border-1 border-border-medium' : '';
  let resolvedFit = fit;
  if (resolvedFit === 'auto') {
    resolvedFit = isVectorAvatar ? 'contain' : 'cover';
  }

  let resolvedShape = shape;
  if (resolvedShape === 'auto') {
    resolvedShape = isVectorAvatar ? 'rounded' : 'circle';
  }

  const imageFitClasses =
    resolvedFit === 'contain' ? 'object-contain object-center' : 'object-cover';
  const imageShapeClasses = resolvedShape === 'rounded' ? 'rounded-[0.95rem]' : 'rounded-full';
  const imageShadowClasses = resolvedFit === 'cover' ? 'shadow-lg' : '';

  let imageSizeClasses = sizeClasses[size];
  if (resolvedFit === 'contain') {
    imageSizeClasses = 'h-[138%] w-[138%]';
    if (visualScale === 'prominent') {
      imageSizeClasses = 'h-[232%] w-[232%]';
    }
    if (visualScale === 'contained') {
      imageSizeClasses = 'h-[96%] w-[96%]';
    }
  }

  const skeletonClass = `absolute inset-0 ${placeholderSizeClasses[size]} ${imageShapeClasses}`;

  if (avatarUrl) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden ${imageShapeClasses} ${sizeClasses[size]} ${className}`}
      >
        <LazyAgentAvatar
          url={avatarUrl}
          alt={`${agent?.name || 'Agent'} avatar`}
          imgClass={`${imageSizeClasses} ${imageShapeClasses} ${imageFitClasses} ${imageShadowClasses} ${borderClasses}`}
          skeletonClass={skeletonClass}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${imageShapeClasses} ${sizeClasses[size]} ${className}`}
    >
      <Feather className={`text-text-primary ${iconSizeClasses[size]}`} strokeWidth={1.5} />
    </div>
  );
};

/**
 * Gets the display name for a contact (prioritizes name over email)
 */
export const getContactDisplayName = (agent: t.Agent | null | undefined): string | null => {
  if (!agent) return null;

  const supportName = (agent as any).support_contact?.name;
  const supportEmail = (agent as any).support_contact?.email;
  const authorName = (agent as any).authorName;

  return supportName || authorName || supportEmail || null;
};

// All hardcoded category constants removed - now using database-driven categories
