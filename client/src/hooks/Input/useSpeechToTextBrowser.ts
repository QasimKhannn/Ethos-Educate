import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { useToastContext } from '@librechat/client';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useGetCustomConfigSpeechQuery } from 'librechat-data-provider/react-query';
import useGetAudioSettings from './useGetAudioSettings';
import { useLocalize } from '~/hooks';
import store from '~/store';

const useSpeechToTextBrowser = (
  setText: (text: string) => void,
  onTranscriptionComplete: (text: string) => void,
) => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { speechToTextEndpoint } = useGetAudioSettings();
  const isBrowserSTTEnabled = speechToTextEndpoint === 'browser';
  const { data: speechConfig } = useGetCustomConfigSpeechQuery({ enabled: true });
  const sttExternal = Boolean(speechConfig?.sttExternal);

  const isResettingRef = useRef(false);
  const lastTranscript = useRef<string>('');
  const [languageSTT] = useRecoilState<string>(store.languageSTT);

  const {
    listening,
    finalTranscript,
    resetTranscript,
    interimTranscript,
    isMicrophoneAvailable,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();
  const isListening = useMemo(() => listening, [listening]);
  const combinedTranscript = useMemo(() => {
    const transcript = `${finalTranscript} ${interimTranscript}`.trim();
    return transcript.replace(/\s+/g, ' ');
  }, [finalTranscript, interimTranscript]);

  useEffect(() => {
    if (isResettingRef.current) {
      if (combinedTranscript.length === 0) {
        isResettingRef.current = false;
      }
      return;
    }

    if (combinedTranscript.length === 0) {
      return;
    }

    if (lastTranscript.current === combinedTranscript) {
      return;
    }

    setText(combinedTranscript);
    lastTranscript.current = combinedTranscript;
  }, [combinedTranscript, setText]);

  const toggleListening = useCallback(() => {
    if (!browserSupportsSpeechRecognition) {
      showToast({
        message: sttExternal
          ? localize('com_ui_speech_not_supported_use_external')
          : localize('com_ui_speech_not_supported'),
        status: 'error',
      });
      return;
    }

    if (!isMicrophoneAvailable) {
      showToast({
        message: localize('com_ui_microphone_unavailable'),
        status: 'error',
      });
      return;
    }

    if (isListening === true) {
      if (combinedTranscript.length > 0) {
        onTranscriptionComplete(combinedTranscript);
      }
      isResettingRef.current = true;
      SpeechRecognition.stopListening();
      lastTranscript.current = '';
      return;
    }

    isResettingRef.current = false;
    resetTranscript();
    lastTranscript.current = '';
    SpeechRecognition.startListening({
      language: languageSTT,
      continuous: true,
    });
  }, [
    browserSupportsSpeechRecognition,
    isListening,
    isMicrophoneAvailable,
    languageSTT,
    localize,
    combinedTranscript,
    onTranscriptionComplete,
    resetTranscript,
    showToast,
    sttExternal,
  ]);

  const resetRecording = useCallback(() => {
    isResettingRef.current = true;
    SpeechRecognition.stopListening();
    resetTranscript();
    lastTranscript.current = '';
  }, [resetTranscript]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && e.code === 'KeyL' && !isBrowserSTTEnabled) {
        toggleListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBrowserSTTEnabled, toggleListening]);

  return {
    isListening,
    isLoading: false,
    resetRecording,
    startRecording: toggleListening,
    stopRecording: toggleListening,
  };
};

export default useSpeechToTextBrowser;
