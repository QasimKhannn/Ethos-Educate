// cowork — microphone / speech-to-text button for the Cowork chat input.
//
// Mirrors client/src/components/Chat/Input/AudioRecorder.tsx but is decoupled from
// the normal chat's react-hook-form context: instead of methods.setValue('text', …)
// it writes transcribed text into Cowork's plain `value`/`onChange` input state.
// Reuses the exact same useSpeechToText hook (browser OR external engine, per the
// user's Speech settings), so it behaves identically to the main chat mic.
import { useCallback, useRef } from 'react';
import { MicOff } from 'lucide-react';
import { TooltipAnchor, ListeningIcon, Spinner } from '@librechat/client';
import { useLocalize, useSpeechToText, useGetAudioSettings } from '~/hooks';
import { globalAudioId } from '~/common';
import { cn } from '~/utils';

const isExternalSTT = (endpoint: string) => endpoint === 'external';

export default function CoworkAudioRecorder({
  disabled,
  value,
  onChange,
}: {
  disabled: boolean;
  /** Current textarea value (text typed before recording starts). */
  value: string;
  /** Replace the textarea value with the transcription result. */
  onChange: (text: string) => void;
}) {
  const localize = useLocalize();
  const { speechToTextEndpoint } = useGetAudioSettings();

  // Text present in the box when recording started — transcription is appended to it.
  const existingTextRef = useRef<string>('');
  // Always-current value + onChange held in refs so setText below stays STABLE.
  // An unstable setText makes the browser STT effect (keyed on [transcript, setText])
  // re-run every render and the transcript never settles into the input — which is
  // exactly why the mic appeared to do nothing.
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onTranscriptionComplete = useCallback((text: string) => {
    if (text) {
      const globalAudio = document.getElementById(globalAudioId) as HTMLAudioElement | null;
      if (globalAudio) {
        globalAudio.muted = false;
      }
    }
  }, []);

  // Browser STT delivers a cumulative transcript; external STT delivers one complete
  // string. In both cases we prepend the pre-recording text exactly once.
  const setText = useCallback((text: string) => {
    const newText = existingTextRef.current ? `${existingTextRef.current} ${text}` : text;
    onChangeRef.current(newText);
  }, []);

  const { isListening, isLoading, startRecording, stopRecording } = useSpeechToText(
    setText,
    onTranscriptionComplete,
  );

  const handleStartRecording = () => {
    existingTextRef.current = valueRef.current || '';
    startRecording();
  };

  const handleStopRecording = () => {
    stopRecording();
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
          type="button"
          aria-label={localize('com_ui_use_micrphone')}
          onClick={isListening === true ? handleStopRecording : handleStartRecording}
          disabled={disabled}
          className={cn(
            'flex size-9 flex-none items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover disabled:opacity-40',
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
