import React, { useState, useEffect } from 'react';
import { Feather } from 'lucide-react';
import { Skeleton } from '@librechat/client';
import type t from 'librechat-data-provider';

type AgentSupportContact = {
  name?: string | null;
  email?: string | null;
};

type AgentContactFields = t.Agent & {
  support_contact?: AgentSupportContact | null;
  authorName?: string | null;
};

const loadedAgentAvatarUrls = new Set<string>();
const legacyStaticAgentIconPath = 'assets/agent-icons/';
const staticAgentIconPath = `${legacyStaticAgentIconPath}style-c/`;
const staticAgentIconPaths = [staticAgentIconPath, legacyStaticAgentIconPath];
const defaultAgentIconPath = `${staticAgentIconPath}default-agent.svg`;
const defaultAgentIconUrl = () => getStaticAgentIconUrl(defaultAgentIconPath);

const staticAgentIconFilesBySlug = new Map<string, string>([
  ['504-plan-generator', '504-plan-generator.svg'],
  ['announcement-writer', 'announcement-writer.svg'],
  ['assessment-and-quiz-builder', 'assessment-quiz-builder.svg'],
  ['class-newsletter-creator', 'class-newsletter-creator.svg'],
  ['coloring-page-creator', 'coloring-page-creator.svg'],
  ['conceptual-diagram-creator', 'conceptual-diagram-creator.svg'],
  ['differentiation-adapter', 'differentiation-adapter.svg'],
  ['downloadable-word-doc-or-pdf', 'word-doc-and-pdf-generator.svg'],
  ['educhat-support-assistant', 'default-agent.svg'],
  ['educational-grants-and-funding-finder', 'educational-grants-funding-finder.svg'],
  ['email-drafter', 'email-drafter.svg'],
  ['ethos-support-assistant', 'default-agent.svg'],
  ['lesson-plan-builder', 'lesson-plan-builder.svg'],
  ['letter-and-memo-generator', 'letter-memo-generator.svg'],
  ['meeting-agenda-builder', 'meeting-agenda-builder.svg'],
  ['meeting-notes-summarizer', 'meeting-notes-summarizer.svg'],
  ['parent-conference-prep-sheet', 'parent-conference-prep-sheet.svg'],
  ['policy-and-document-summarizer', 'policy-document-summarizer.svg'],
  ['poster-design', 'school-poster-designer.svg'],
  ['powerpoint-presentation-creator', 'powerpoint-presentation-creator.svg'],
  ['professional-development-plan-creator', 'professional-development-plan-creator.svg'],
  ['real-world-examples-generator', 'real-world-examples-generator.svg'],
  ['report-card-comment-writer', 'report-card-comment-writer.svg'],
  ['rubric-creator', 'rubric-creator.svg'],
  ['social-media-post-generator', 'social-media-post-generator.svg'],
  ['spreadsheet-excel-creator', 'spreadsheet-excel-creator.svg'],
  ['standards-translator', 'standard-translator.svg'],
  ['student-certificate-creator', 'student-certificate-creator.svg'],
  ['survey-builder', 'survey-builder.svg'],
  ['translation-assistant', 'translation-assistant.svg'],
  ['vocabulary-and-spelling-list-builder', 'vocabulary-spelling-list-builder.svg'],
  ['word-doc-and-pdf-generator', 'word-doc-and-pdf-generator.svg'],
  ['worksheet-generator', 'worksheet-generator.svg'],
  ['youtube-video-finder', 'youtube-video-finder.svg'],
]);

const getAppBasePath = () => {
  if (typeof document === 'undefined') {
    return '/';
  }

  const baseHref = document.querySelector('base')?.getAttribute('href') ?? '/';
  if (!baseHref) {
    return '/';
  }

  return baseHref.endsWith('/') ? baseHref : `${baseHref}/`;
};

const getStaticAgentIconUrl = (assetPath: string) => `${getAppBasePath()}${assetPath}`;

const getAgentNameSlug = (name: string | null | undefined): string | null => {
  const slug = name
    ?.trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\(([^)]*)\)/g, ' $1 ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || null;
};

export const normalizeAgentBrandText = (value: string | null | undefined): string => {
  return (
    value?.replace(/\bLibreChat\b/gi, 'Ethos Enterprise').replace(/\bEduChat\b/gi, 'Ethos') ?? ''
  );
};

export const getAgentDisplayName = (agent: t.Agent | null | undefined): string => {
  return normalizeAgentBrandText(agent?.name);
};

export const getStaticAgentIconUrlForName = (name: string | null | undefined): string | null => {
  const slug = getAgentNameSlug(name);
  if (!slug) {
    return null;
  }

  const iconFileName = staticAgentIconFilesBySlug.get(slug);
  return iconFileName ? getStaticAgentIconUrl(`${staticAgentIconPath}${iconFileName}`) : null;
};

export const getAgentAvatarImageUrl = (agent: t.Agent | null | undefined): string | null => {
  return (
    getStaticAgentIconUrlForName(agent?.name) ?? normalizeAgentAvatarUrl(getAgentAvatarUrl(agent))
  );
};

export const isStaticAgentIconUrl = (url: string) => {
  const pathWithoutParams = url.split(/[?#]/)[0]?.toLowerCase() ?? '';
  return (
    staticAgentIconPaths.some((iconPath) => pathWithoutParams.includes(`/${iconPath}`)) &&
    pathWithoutParams.endsWith('.svg')
  );
};

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

export const normalizeAgentAvatarUrl = (url: string | null): string | null => {
  const trimmedUrl = url?.trim();
  if (!trimmedUrl) {
    return null;
  }

  const normalizedUrl = trimmedUrl.toLowerCase();
  const matchedStaticIconPath = staticAgentIconPaths.find(
    (iconPath) => normalizedUrl.indexOf(iconPath) !== -1,
  );
  if (!matchedStaticIconPath) {
    return trimmedUrl;
  }

  const staticIconIndex = normalizedUrl.indexOf(matchedStaticIconPath);
  const staticIconAssetPath = trimmedUrl.slice(staticIconIndex).replace(/^\/+/, '');
  const typeCStaticIconAssetPath =
    matchedStaticIconPath === legacyStaticAgentIconPath
      ? staticIconAssetPath.replace(legacyStaticAgentIconPath, staticAgentIconPath)
      : staticIconAssetPath;
  return getStaticAgentIconUrl(typeCStaticIconAssetPath);
};

export const isAgentAvatarImageUrl = (url: string | null | undefined): boolean => {
  const normalizedUrl = normalizeAgentAvatarUrl(url ?? null);
  if (!normalizedUrl) {
    return false;
  }

  return (
    /^(https?:|data:)/i.test(normalizedUrl) ||
    normalizedUrl.startsWith('/images/') ||
    isStaticAgentIconUrl(normalizedUrl)
  );
};

const LazyAgentAvatar = ({
  url,
  alt,
  imgClass,
  skeletonClass,
  fallback,
  fallbackUrl,
}: {
  url: string;
  alt: string;
  imgClass: string;
  skeletonClass: string;
  fallback: React.ReactElement;
  fallbackUrl?: string | null;
}) => {
  const [currentUrl, setCurrentUrl] = useState(url);
  const isStaticSvgAvatar = isStaticAgentIconUrl(currentUrl);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(
    () => isStaticSvgAvatar || loadedAgentAvatarUrls.has(currentUrl),
  );

  useEffect(() => {
    setCurrentUrl(url);
    setHasError(false);
    setIsLoaded(isStaticAgentIconUrl(url) || loadedAgentAvatarUrls.has(url));
  }, [url]);

  if (hasError) {
    return fallback;
  }

  return (
    <>
      <img
        src={currentUrl}
        alt={alt}
        className={imgClass}
        loading={isStaticSvgAvatar ? 'eager' : 'lazy'}
        onLoad={() => {
          loadedAgentAvatarUrls.add(currentUrl);
          setIsLoaded(true);
        }}
        onError={() => {
          loadedAgentAvatarUrls.delete(currentUrl);
          if (fallbackUrl && currentUrl !== fallbackUrl) {
            setCurrentUrl(fallbackUrl);
            setIsLoaded(
              isStaticAgentIconUrl(fallbackUrl) || loadedAgentAvatarUrls.has(fallbackUrl),
            );
            return;
          }
          setHasError(true);
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

  const avatarUrl = getAgentAvatarImageUrl(agent);
  const normalizedAvatarUrl = avatarUrl?.split(/[?#]/)[0]?.toLowerCase() ?? '';
  const isVectorAvatar = avatarUrl == null || normalizedAvatarUrl.endsWith('.svg');
  const agentName = getAgentDisplayName(agent) || agent?.name || 'Agent';

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

  const fallbackIcon = (
    <Feather className={`text-text-primary ${iconSizeClasses[size]}`} strokeWidth={1.5} />
  );
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

  if (avatarUrl || size !== 'icon') {
    const fallbackAvatarUrl = defaultAgentIconUrl();
    const resolvedAvatarUrl = avatarUrl ?? fallbackAvatarUrl;

    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden ${imageShapeClasses} ${sizeClasses[size]} ${className}`}
      >
        <LazyAgentAvatar
          url={resolvedAvatarUrl}
          alt={`${agentName} avatar`}
          imgClass={`${imageSizeClasses} ${imageShapeClasses} ${imageFitClasses} ${imageShadowClasses} ${borderClasses} ${
            isVectorAvatar ? 'agent-avatar-image--vector' : 'agent-avatar-image--photo'
          }`}
          skeletonClass={skeletonClass}
          fallback={fallbackIcon}
          fallbackUrl={resolvedAvatarUrl !== fallbackAvatarUrl ? fallbackAvatarUrl : null}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${imageShapeClasses} ${sizeClasses[size]} ${className}`}
    >
      {fallbackIcon}
    </div>
  );
};

/**
 * Gets the display name for a contact (prioritizes name over email)
 */
export const getContactDisplayName = (agent: t.Agent | null | undefined): string | null => {
  if (!agent) return null;

  const { support_contact: supportContact, authorName } = agent as AgentContactFields;
  const displayName = supportContact?.name || authorName || supportContact?.email || null;

  return displayName ? normalizeAgentBrandText(displayName) : null;
};

// All hardcoded category constants removed - now using database-driven categories
