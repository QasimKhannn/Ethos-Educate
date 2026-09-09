import React, { useRef, useState } from 'react';
import { Expand, Maximize2, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import {
  OGDialog,
  OGDialogClose,
  OGDialogContent,
  OGDialogTitle,
  useMediaQuery,
} from '@librechat/client';
import { useLocalize } from '~/hooks';

const formatVideoTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
};

const AgentOfTheDayVideoPlaceholder: React.FC = () => {
  const localize = useLocalize();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playPosition, setPlayPosition] = useState({ x: 50, y: 50 });
  const videoFrameRef = useRef<HTMLDivElement>(null);
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const desktopVideoSrc = '/assets/agent-walkthroughs/ethos-youtube-video-finder.mp4';
  const desktopGifSrc = '/assets/agent-walkthroughs/ethos-youtube-video-finder.gif';
  const mobileVideoSrc = '/assets/agent-walkthroughs/ethos-youtube-video-finder-mobile.mp4';
  const videoSrc = isMobile ? mobileVideoSrc : desktopVideoSrc;

  const openVideo = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsOpen(true);
  };

  const handleVideoKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    event.stopPropagation();
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setIsOpen(true);
  };

  const handleVideoPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || !videoFrameRef.current) return;

    const frame = videoFrameRef.current.getBoundingClientRect();
    const x = Math.min(90, Math.max(10, ((event.clientX - frame.left) / frame.width) * 100));
    const y = Math.min(82, Math.max(18, ((event.clientY - frame.top) / frame.height) * 100));
    setPlayPosition({ x, y });
  };

  const togglePlayback = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const video = modalVideoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => undefined);
      return;
    }
    video.pause();
  };

  const toggleMute = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const video = modalVideoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const video = modalVideoRef.current;
    const nextTime = Number(event.target.value);
    if (!video || !Number.isFinite(nextTime)) return;

    video.currentTime = nextTime;
    setProgress(nextTime);
  };

  const handleFullscreen = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const video = modalVideoRef.current;
    if (!video?.requestFullscreen) return;

    void video.requestFullscreen();
  };

  return (
    <>
      <div
        className="agents-marketplace-agent-of-day-video"
        role="region"
        aria-label={localize('com_agents_agent_of_day_video_label')}
        data-testid="agent-of-day-video-placeholder"
      >
        <div
          ref={videoFrameRef}
          className="agents-marketplace-agent-of-day-video-frame"
          role="button"
          tabIndex={0}
          aria-label={localize('com_agents_agent_of_day_video_expand')}
          data-testid="agent-of-day-video-trigger"
          onClick={openVideo}
          onKeyDown={handleVideoKeyDown}
          onPointerMove={handleVideoPointerMove}
        >
          {isMobile ? (
            <video
              className="agents-marketplace-agent-of-day-video-media"
              src={videoSrc}
              muted
              autoPlay
              loop
              playsInline
              preload="metadata"
              aria-label={localize('com_agents_agent_of_day_video_title')}
            >
              <track
                kind="captions"
                srcLang="en"
                label="English captions"
                src="/assets/agent-walkthroughs/ethos-youtube-video-finder.vtt"
              />
            </video>
          ) : (
            <img
              className="agents-marketplace-agent-of-day-video-media"
              src={desktopGifSrc}
              alt=""
              aria-hidden="true"
            />
          )}
          <span className="agents-marketplace-agent-of-day-video-scrim" aria-hidden="true" />
          <span
            className="agents-marketplace-agent-of-day-video-icon"
            aria-hidden="true"
            style={{ left: `${playPosition.x}%`, top: `${playPosition.y}%` }}
          >
            <Play size={16} strokeWidth={1.8} />
          </span>
          <span className="agents-marketplace-agent-of-day-video-expand" aria-hidden="true">
            <Expand size={14} strokeWidth={1.8} />
          </span>
        </div>
      </div>

      <OGDialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setIsPlaying(false);
            setProgress(0);
          }
        }}
      >
        <OGDialogContent
          className="agents-marketplace-agent-of-day-video-dialog max-h-[92vh] w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-2xl p-0"
          data-testid="agent-of-day-video-modal"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div className="agents-marketplace-agent-of-day-video-dialog-media-shell">
            <OGDialogTitle className="sr-only">
              {localize('com_agents_agent_of_day_video_title')}
            </OGDialogTitle>
            <OGDialogClose
              className="agents-marketplace-agent-of-day-video-dialog-close"
              aria-label={localize('com_ui_close')}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <X size={18} aria-hidden="true" />
            </OGDialogClose>
            <video
              ref={modalVideoRef}
              className="agents-marketplace-agent-of-day-video-dialog-media"
              src={videoSrc}
              autoPlay
              playsInline
              preload="metadata"
              aria-label={localize('com_agents_agent_of_day_video_title')}
              onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
              onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onVolumeChange={(event) => setIsMuted(event.currentTarget.muted)}
            >
              <track
                kind="captions"
                srcLang="en"
                label="English captions"
                src="/assets/agent-walkthroughs/ethos-youtube-video-finder.vtt"
              />
            </video>
            <div
              className="agents-marketplace-agent-of-day-video-dialog-controls"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="agents-marketplace-agent-of-day-video-dialog-control"
                aria-label={localize(
                  isPlaying
                    ? 'com_agents_agent_of_day_video_pause'
                    : 'com_agents_agent_of_day_video_play',
                )}
                onClick={togglePlayback}
              >
                {isPlaying ? (
                  <Pause size={16} aria-hidden="true" />
                ) : (
                  <Play size={16} aria-hidden="true" />
                )}
              </button>
              <span
                className="agents-marketplace-agent-of-day-video-dialog-time"
                aria-hidden="true"
              >
                {formatVideoTime(progress)}
              </span>
              <input
                className="agents-marketplace-agent-of-day-video-dialog-range"
                type="range"
                min="0"
                max={Math.max(duration, 0.1)}
                step="0.1"
                value={Math.min(progress, Math.max(duration, 0.1))}
                aria-label={localize('com_agents_agent_of_day_video_seek')}
                onChange={handleSeek}
              />
              <span
                className="agents-marketplace-agent-of-day-video-dialog-time"
                aria-hidden="true"
              >
                {formatVideoTime(duration)}
              </span>
              <button
                type="button"
                className="agents-marketplace-agent-of-day-video-dialog-control"
                aria-label={localize(
                  isMuted
                    ? 'com_agents_agent_of_day_video_unmute'
                    : 'com_agents_agent_of_day_video_mute',
                )}
                onClick={toggleMute}
              >
                {isMuted ? (
                  <VolumeX size={16} aria-hidden="true" />
                ) : (
                  <Volume2 size={16} aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                className="agents-marketplace-agent-of-day-video-dialog-control"
                aria-label={localize('com_agents_agent_of_day_video_fullscreen')}
                onClick={handleFullscreen}
              >
                <Maximize2 size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </OGDialogContent>
      </OGDialog>
    </>
  );
};

export default AgentOfTheDayVideoPlaceholder;
