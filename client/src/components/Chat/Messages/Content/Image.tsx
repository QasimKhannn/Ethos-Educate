import React, { useState, useRef, useMemo, useEffect } from 'react';
import { isAxiosError } from 'axios';
import { Download } from 'lucide-react';
import { Button, Skeleton, TooltipAnchor } from '@librechat/client';
import { apiBaseUrl, dataService, FileContext, FileSources } from 'librechat-data-provider';
import ExpiredGeneratedArtifact from './ExpiredGeneratedArtifact';
import DialogImage from './DialogImage';
import { isGeneratedArtifactExpired } from './generatedArtifacts';
import { cn } from '~/utils';

/** Max display height for chat images (Tailwind JIT class) */
export const IMAGE_MAX_H = 'max-h-[45vh]' as const;
/** Matches the `max-w-lg` Tailwind class on the wrapper button (32rem = 512px at 16px base) */
const IMAGE_MAX_W_PX = 512;
const IMAGE_LOADING_STYLE: React.CSSProperties = {
  height: 'min(45vh, 75vw, 20rem)',
  width: 'min(100%, 20rem)',
};

const requestAfterPaint = (callback: FrameRequestCallback): void => {
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(callback);
    return;
  }

  callback(0);
};

const isEthosManagedFile = (source?: string) =>
  source != null &&
  [FileSources.local, FileSources.firebase, FileSources.s3, FileSources.azure_blob].includes(
    source as FileSources,
  );

type ImageDimensions = { width: number; height: number };

/** Caches browser-decoded dimensions by src so remounts use the real image ratio. */
const dimensionCache = new Map<string, ImageDimensions>();
/** Tracks URLs that have been fully painted — skip skeleton on remount */
const paintedUrls = new Set<string>();

/** Test-only: resets module-level caches */
export function _resetImageCaches(): void {
  dimensionCache.clear();
  paintedUrls.clear();
}

function computeHeightStyle(w: number, h: number): React.CSSProperties {
  return { height: `min(45vh, ${(h / w) * 100}vw, ${(h / w) * IMAGE_MAX_W_PX}px)` };
}

const Image = ({
  imagePath,
  altText,
  className,
  args,
  width,
  height,
  fileId,
  userId,
  source,
  context,
  retentionExpiresAt,
}: {
  imagePath: string;
  altText: string;
  className?: string;
  args?: {
    prompt?: string;
    quality?: 'low' | 'medium' | 'high';
    size?: string;
    style?: string;
    [key: string]: unknown;
  };
  width?: number;
  height?: number;
  fileId?: string;
  userId?: string;
  source?: string;
  context?: FileContext;
  retentionExpiresAt?: string | Date;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [managedPreviewUrl, setManagedPreviewUrl] = useState<string | null>(null);
  const [managedPreviewFailed, setManagedPreviewFailed] = useState(false);
  const [managedPreviewExpired, setManagedPreviewExpired] = useState(false);
  const [loadedDimensions, setLoadedDimensions] = useState<
    (ImageDimensions & { source: string }) | null
  >(null);
  const [readyImageUrl, setReadyImageUrl] = useState<string | null>(null);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeImageUrlRef = useRef('');

  const sourceImageUrl = useMemo(() => {
    if (!imagePath) return imagePath;

    if (
      imagePath.startsWith('http') ||
      imagePath.startsWith('data:') ||
      !imagePath.startsWith('/images/')
    ) {
      return imagePath;
    }

    const baseURL = apiBaseUrl();
    return `${baseURL}${imagePath}`;
  }, [imagePath]);

  const isManagedImage = Boolean(fileId && userId && isEthosManagedFile(source));
  const isGeneratedImage = context === FileContext.image_generation;
  const hasExpiredRetention = isGeneratedImage && isGeneratedArtifactExpired(retentionExpiresAt);

  useEffect(() => {
    if (!isManagedImage || !fileId || !userId || hasExpiredRetention) {
      setManagedPreviewUrl(null);
      setManagedPreviewFailed(false);
      setManagedPreviewExpired(false);
      return;
    }

    let previewUrl: string | undefined;
    let cancelled = false;

    setManagedPreviewUrl(null);
    setManagedPreviewFailed(false);
    setManagedPreviewExpired(false);

    void dataService
      .getFilePreview(userId, fileId)
      .then((response) => {
        if (cancelled) {
          return;
        }

        previewUrl = window.URL.createObjectURL(response.data);
        setManagedPreviewUrl(previewUrl);
      })
      .catch((error) => {
        if (!cancelled) {
          if (isAxiosError(error) && error.response?.status === 410) {
            setManagedPreviewExpired(true);
            return;
          }

          console.error('Managed image preview failed:', error);
          setManagedPreviewFailed(true);
        }
      });

    return () => {
      cancelled = true;
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [fileId, hasExpiredRetention, isManagedImage, userId]);

  const absoluteImageUrl = isManagedImage
    ? (managedPreviewUrl ?? (managedPreviewFailed ? sourceImageUrl : ''))
    : sourceImageUrl;

  useEffect(() => {
    activeImageUrlRef.current = absoluteImageUrl;
    setFailedImageUrl(null);

    return () => {
      if (activeImageUrlRef.current === absoluteImageUrl) {
        activeImageUrlRef.current = '';
      }
    };
  }, [absoluteImageUrl]);

  const downloadImage = async () => {
    try {
      const response = await fetch(absoluteImageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = altText || 'image.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      const link = document.createElement('a');
      link.href = absoluteImageUrl;
      link.download = altText || 'image.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const actualDimensions =
    loadedDimensions?.source === absoluteImageUrl
      ? loadedDimensions
      : dimensionCache.get(absoluteImageUrl);
  const suppliedDimensions = width && height ? { width, height } : undefined;
  const dims = actualDimensions ?? suppliedDimensions;
  const hasDimensions = !!(dims?.width && dims?.height);
  const isImageFailed = failedImageUrl === absoluteImageUrl;
  const isImageReady =
    absoluteImageUrl !== '' &&
    !isImageFailed &&
    (readyImageUrl === absoluteImageUrl || paintedUrls.has(absoluteImageUrl));
  const showSkeleton = !isImageReady && !isImageFailed;
  let imageStyle: React.CSSProperties | undefined;
  if (hasDimensions && dims) {
    imageStyle = computeHeightStyle(dims.width, dims.height);
  } else if (showSkeleton) {
    imageStyle = IMAGE_LOADING_STYLE;
  }
  const isExpired = hasExpiredRetention || managedPreviewExpired;

  const handleImageLoad = async (event: React.SyntheticEvent<HTMLImageElement>) => {
    const imageUrl = absoluteImageUrl;
    if (!imageUrl) {
      return;
    }

    const image = event.currentTarget;
    const decoded = image.decode?.();
    if (decoded) {
      await decoded.catch(() => undefined);
    }

    if (activeImageUrlRef.current !== imageUrl) {
      return;
    }

    const { naturalHeight, naturalWidth } = image;
    const dimensions =
      naturalWidth && naturalHeight ? { width: naturalWidth, height: naturalHeight } : null;

    requestAfterPaint(() => {
      if (activeImageUrlRef.current !== imageUrl) {
        return;
      }

      paintedUrls.add(imageUrl);
      setReadyImageUrl(imageUrl);
      setFailedImageUrl(null);
      if (dimensions) {
        dimensionCache.set(imageUrl, dimensions);
        setLoadedDimensions({ source: imageUrl, ...dimensions });
      }
    });
  };

  const handleImageError = () => {
    if (isManagedImage && !managedPreviewFailed) {
      setManagedPreviewUrl(null);
      setManagedPreviewFailed(true);
      return;
    }

    setFailedImageUrl(absoluteImageUrl);
  };

  if (isExpired) {
    return <ExpiredGeneratedArtifact artifactType="image" />;
  }

  return (
    <div className="relative w-fit max-w-full">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`View ${altText} in dialog`}
        aria-haspopup="dialog"
        aria-busy={!isImageReady && !isImageFailed}
        onClick={() => absoluteImageUrl && setIsOpen(true)}
        className={cn(
          'relative mt-1 w-full max-w-lg overflow-hidden rounded-lg border border-border-light text-text-secondary-alt shadow-md transition-shadow',
          isImageReady || isImageFailed ? 'cursor-pointer' : 'cursor-wait',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary',
          className,
        )}
        style={imageStyle}
      >
        {showSkeleton && <Skeleton className="absolute inset-0 z-10" aria-hidden="true" />}
        {absoluteImageUrl && (
          <img
            alt={altText}
            src={absoluteImageUrl}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={cn(
              'relative z-0 block text-transparent transition-opacity duration-200 ease-out',
              isImageReady || isImageFailed ? 'opacity-100' : 'opacity-0',
              hasDimensions
                ? 'size-full object-contain'
                : cn('h-auto w-auto max-w-full', IMAGE_MAX_H),
            )}
          />
        )}
      </button>
      <TooltipAnchor
        description="Download image"
        render={
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => void downloadImage()}
            aria-label="Download image"
            className="absolute right-2 top-3 z-10 size-8 bg-black/55 text-white shadow-sm hover:bg-black/75"
          >
            <Download className="size-4" aria-hidden="true" />
          </Button>
        }
      />
      <DialogImage
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        src={absoluteImageUrl}
        downloadImage={downloadImage}
        args={args}
        triggerRef={triggerRef}
      />
    </div>
  );
};

export default Image;
