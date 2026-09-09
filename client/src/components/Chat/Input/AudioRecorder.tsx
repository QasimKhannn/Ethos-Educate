import { useCallback, useEffect, useRef, useState } from 'react';
import { TooltipAnchor, ListeningIcon, Spinner } from '@librechat/client';
import { useLocalize, useSpeechToText, useGetAudioSettings } from '~/hooks';
import { useChatFormContext } from '~/Providers';
import { chatMessageSubmittedEvent, globalAudioId } from '~/common';
import { cn } from '~/utils';

const isExternalSTT = (speechToTextEndpoint: string) => speechToTextEndpoint === 'external';

const formatRecordingTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default function AudioRecorder({
  disabled,
  methods,
  textAreaRef,
}: {
  disabled: boolean;
  methods: ReturnType<typeof useChatFormContext>;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
}) {
  const { setValue, getValues } = methods;
  const localize = useLocalize();
  const { speechToTextEndpoint } = useGetAudioSettings();

  const existingTextRef = useRef<string>('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const onTranscriptionComplete = useCallback((text: string) => {
    if (text) {
      const globalAudio = document.getElementById(globalAudioId) as HTMLAudioElement | null;
      if (globalAudio) {
        globalAudio.muted = false;
      }
    }
  }, []);

  const setText = useCallback(
    (text: string) => {
      let newText = text;
      if (isExternalSTT(speechToTextEndpoint)) {
        /** For external STT, the text comes as a complete transcription, so append to existing */
        newText = existingTextRef.current ? `${existingTextRef.current} ${text}` : text;
      } else {
        /** For browser STT, the transcript is cumulative, so we only need to prepend the existing text once */
        newText = existingTextRef.current ? `${existingTextRef.current} ${text}` : text;
      }
      setValue('text', newText, {
        shouldValidate: true,
      });
    },
    [setValue, speechToTextEndpoint],
  );

  const { isListening, isLoading, resetRecording, startRecording, stopRecording } = useSpeechToText(
    setText,
    onTranscriptionComplete,
  );

  useEffect(() => {
    const handleMessageSubmitted = () => {
      setValue('text', '', {
        shouldValidate: true,
      });

      if (!isListening) {
        existingTextRef.current = '';
        return;
      }

      resetRecording();
      existingTextRef.current = '';
    };

    window.addEventListener(chatMessageSubmittedEvent, handleMessageSubmitted);

    return () => {
      window.removeEventListener(chatMessageSubmittedEvent, handleMessageSubmitted);
    };
  }, [isListening, resetRecording, setValue]);

  useEffect(() => {
    if (!isListening) {
      setRecordingSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [isListening]);

  if (!textAreaRef.current) {
    return null;
  }

  const handleStartRecording = async () => {
    existingTextRef.current = getValues('text') || '';
    startRecording();
  };

  const handleStopRecording = async () => {
    stopRecording();
    /** For browser STT, clear the reference since text was already being updated */
    if (!isExternalSTT(speechToTextEndpoint)) {
      existingTextRef.current = '';
    }
  };

  if (isListening) {
    return (
      <div className="chat-composer-recording-shell" role="status" aria-live="polite">
        <div className="chat-composer-recording-meta">
          <span className="chat-composer-recording-dot" aria-hidden="true" />
          <span className="chat-composer-recording-meter" aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <span key={index} className="chat-composer-recording-bar" />
            ))}
          </span>
          <span className="chat-composer-recording-label">{localize('com_ui_recording')}</span>
          <span className="chat-composer-recording-time">
            {formatRecordingTime(recordingSeconds)}
          </span>
        </div>
        <TooltipAnchor
          description={localize('com_ui_stop_recording')}
          render={
            <button
              id="audio-recorder"
              type="button"
              className="chat-composer-recording-stop"
              aria-label={localize('com_ui_stop_recording')}
              onClick={handleStopRecording}
            >
              <span className="chat-composer-recording-stop-icon" aria-hidden="true" />
            </button>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="chat-composer-recording-shell chat-composer-recording-shell-processing"
        role="status"
        aria-live="polite"
      >
        <div className="chat-composer-recording-meta">
          <Spinner className="chat-composer-recording-spinner" />
          <span className="chat-composer-recording-label">
            {localize('com_ui_processing_audio')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <TooltipAnchor
      description={localize('com_ui_tooltip_use_microphone')}
      render={
        <button
          id="audio-recorder"
          type="button"
          aria-label={localize('com_ui_use_micrphone')}
          onClick={handleStartRecording}
          disabled={disabled}
          className={cn('chat-composer-utility-button')}
          title={localize('com_ui_use_micrphone')}
        >
          <ListeningIcon className="chat-composer-control-icon stroke-current" />
        </button>
      }
    />
  );
}
