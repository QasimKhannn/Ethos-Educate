import { useState, useEffect, useCallback, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button, TooltipAnchor } from '@librechat/client';
import { X, ArrowDownToLine, RotateCcw } from 'lucide-react';
import { useLocalize } from '~/hooks';

export default function DialogImage({
  isOpen,
  onOpenChange,
  src = '',
  downloadImage,
  triggerRef,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  src?: string;
  downloadImage: () => void;
  args?: {
    prompt?: string;
    quality?: string;
    size?: string;
    [key: string]: unknown;
  };
  triggerRef?: React.RefObject<HTMLButtonElement>;
  showDetails?: boolean;
}) {
  const localize = useLocalize();

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, []);

  const getCursor = () => {
    if (zoom <= 1) return 'default';
    return isDragging ? 'grabbing' : 'grab';
  };

  const handleDoubleClick = useCallback(() => {
    if (zoom > 1) {
      resetZoom();
    } else {
      setZoom(2);
    }
  }, [zoom, resetZoom]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoom * zoomFactor, 1), 5);

      if (newZoom === zoom) return;

      if (newZoom === 1) {
        setZoom(1);
        setPanX(0);
        setPanY(0);
        return;
      }

      const containerCenterX = rect.width / 2;
      const containerCenterY = rect.height / 2;

      const zoomRatio = newZoom / zoom;
      const deltaX = (mouseX - containerCenterX - panX) * (zoomRatio - 1);
      const deltaY = (mouseY - containerCenterY - panY) * (zoomRatio - 1);

      setZoom(newZoom);
      setPanX(panX - deltaX);
      setPanY(panY - deltaY);
    },
    [zoom, panX, panY],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (zoom <= 1) return;
      setIsDragging(true);
      setDragStart({
        x: e.clientX - panX,
        y: e.clientY - panY,
      });
    },
    [zoom, panX, panY],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging || zoom <= 1) return;
      const newPanX = e.clientX - dragStart.x;
      const newPanY = e.clientY - dragStart.y;
      setPanX(newPanX);
      setPanY(newPanY);
    },
    [isDragging, dragStart, zoom],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle click on empty areas to close (only if clicking overlay/content directly, not children)
  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only close if clicking directly on overlay/content background
      if (e.target !== e.currentTarget) {
        return;
      }
      // Don't close if zoomed (user might be panning)
      if (zoom > 1) {
        return;
      }
      onOpenChange(false);
    },
    [onOpenChange, zoom],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoom > 1) {
          resetZoom();
        } else {
          onOpenChange(false);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [resetZoom, onOpenChange, isOpen, zoom]);

  useEffect(() => {
    if (isOpen && src) {
      resetZoom();
    }
  }, [isOpen, src, resetZoom]);

  useEffect(() => {
    if (zoom === 1) {
      setPanX(0);
      setPanY(0);
    }
  }, [zoom]);

  // Lock body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[100] bg-black/90"
          onClick={handleBackgroundClick}
        />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[100] flex items-center justify-center outline-none"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            closeButtonRef.current?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            triggerRef?.current?.focus();
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
          onClick={handleBackgroundClick}
        >
          {/* Close button - top left */}
          <div className="absolute left-4 top-4 z-20">
            <TooltipAnchor
              description={localize('com_ui_tooltip_close_image')}
              render={
                <Button
                  ref={closeButtonRef}
                  onClick={() => onOpenChange(false)}
                  variant="ghost"
                  className="h-10 w-10 p-0 text-white hover:bg-white/10"
                  aria-label={localize('com_ui_close')}
                >
                  <X className="size-6" aria-hidden="true" />
                </Button>
              }
            />
          </div>

          {/* Action buttons - top right */}
          <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
            {zoom > 1 && (
              <TooltipAnchor
                description={localize('com_ui_tooltip_reset_zoom')}
                render={
                  <Button
                    onClick={resetZoom}
                    variant="ghost"
                    className="h-10 w-10 p-0 text-white hover:bg-white/10"
                    aria-label={localize('com_ui_reset_zoom')}
                  >
                    <RotateCcw className="size-5" aria-hidden="true" />
                  </Button>
                }
              />
            )}
            <TooltipAnchor
              description={localize('com_ui_tooltip_download_image')}
              render={
                <Button
                  onClick={() => downloadImage()}
                  variant="ghost"
                  className="h-10 w-10 p-0 text-white hover:bg-white/10"
                  aria-label={localize('com_ui_download')}
                >
                  <ArrowDownToLine className="size-5" aria-hidden="true" />
                </Button>
              }
            />
          </div>

          {/* Image container - centered */}
          <div onClick={(e) => e.stopPropagation()}>
            <div
              ref={containerRef}
              className="relative"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onDoubleClick={handleDoubleClick}
              style={{ cursor: getCursor() }}
            >
              <div
                className="transition-transform duration-100 ease-out"
                style={{
                  transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                }}
              >
                <img
                  src={src}
                  alt="Image"
                  decoding="async"
                  className="block max-h-[85vh] object-contain"
                  style={{ maxWidth: '90vw' }}
                  draggable={false}
                />
              </div>
            </div>
          </div>

        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
