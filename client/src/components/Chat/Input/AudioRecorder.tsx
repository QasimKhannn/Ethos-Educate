import { useCallback, useEffect, useRef } from 'react';
import { MicOff } from 'lucide-react';
import { TooltipAnchor, ListeningIcon, Spinner } from '@librechat/client';
import { useLocalize, useSpeechToText, useGetAudioSettings } from '~/hooks';
import { useChatFormContext } from '~/Providers';
import { chatMessageSubmittedEvent, globalAudioId } from '~/common';
import { cn } from '~/utils';

const isExternalSTT = (speechToTextEndpoint: string) => speechToTextEndpoint === 'external';
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

  const renderIcon = () => {
    if (isListening === true) {
      return <MicOff className="stroke-red-500" />;
    }
    if (isLoading === true) {
      return <Spinner className="stroke-text-secondary" />;
    }
    return <ListeningIcon className="stroke-text-secondary" />;
  };

  return (
    <TooltipAnchor
      description={localize('com_ui_use_micrphone')}
      render={
        <button
          id="audio-recorder"
          type="button"
          aria-label={localize('com_ui_use_micrphone')}
          onClick={isListening === true ? handleStopRecording : handleStartRecording}
          disabled={disabled}
          className={cn(
            'flex size-9 items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover',
          )}
          title={localize('com_ui_use_micrphone')}
          aria-pressed={isListening}
        >
          {renderIcon()}
        </button>
      }
    />
  );
}
