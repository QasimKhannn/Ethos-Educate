import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button, Skeleton, TooltipAnchor } from '@librechat/client';
import { apiBaseUrl, dataService, FileSources } from 'librechat-data-provider';
import DialogImage from './DialogImage';
import { cn } from '~/utils';

/** Max display height for chat images (Tailwind JIT class) */
export const IMAGE_MAX_H = 'max-h-[45vh]' as const;
/** Matches the `max-w-lg` Tailwind class on the wrapper button (32rem = 512px at 16px base) */
const IMAGE_MAX_W_PX = 512;

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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [managedPreviewUrl, setManagedPreviewUrl] = useState<string | null>(null);
  const [managedPreviewFailed, setManagedPreviewFailed] = useState(false);
  const [loadedDimensions, setLoadedDimensions] = useState<
    (ImageDimensions & { source: string }) | null
  >(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (!isManagedImage || !fileId || !userId) {
      setManagedPreviewUrl(null);
      setManagedPreviewFailed(false);
      return;
    }

    let previewUrl: string | undefined;
    let cancelled = false;

    setManagedPreviewUrl(null);
    setManagedPreviewFailed(false);

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
  }, [fileId, isManagedImage, userId]);

  const absoluteImageUrl = isManagedImage
    ? (managedPreviewUrl ?? (managedPreviewFailed ? sourceImageUrl : ''))
    : sourceImageUrl;

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
  const heightStyle = hasDimensions ? computeHeightStyle(dims.width, dims.height) : undefined;
  const showSkeleton = hasDimensions && (!absoluteImageUrl || !paintedUrls.has(absoluteImageUrl));

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (!absoluteImageUrl) {
      return;
    }

    paintedUrls.add(absoluteImageUrl);

    const { naturalHeight, naturalWidth } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) {
      return;
    }

    const dimensions = { width: naturalWidth, height: naturalHeight };
    dimensionCache.set(absoluteImageUrl, dimensions);
    setLoadedDimensions({ source: absoluteImageUrl, ...dimensions });
  };

  return (
    <div className="relative w-fit max-w-full">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`View ${altText} in dialog`}
        aria-haspopup="dialog"
        onClick={() => absoluteImageUrl && setIsOpen(true)}
        className={cn(
          'relative mt-1 w-full max-w-lg cursor-pointer overflow-hidden rounded-lg border border-border-light text-text-secondary-alt shadow-md transition-shadow',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary',
          className,
        )}
        style={heightStyle}
      >
        {showSkeleton && <Skeleton className="absolute inset-0" aria-hidden="true" />}
        {absoluteImageUrl && (
          <img
            alt={altText}
            src={absoluteImageUrl}
            onLoad={handleImageLoad}
            onError={() => {
              if (isManagedImage && !managedPreviewFailed) {
                setManagedPreviewUrl(null);
                setManagedPreviewFailed(true);
              }
            }}
            className={cn(
              'relative block text-transparent',
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
