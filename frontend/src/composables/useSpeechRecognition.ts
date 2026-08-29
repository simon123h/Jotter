import { ref, onUnmounted, getCurrentInstance } from 'vue';
import { useI18n } from './useI18n';
import { useToast } from './useToast';

// Web Speech API interface declarations
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: {
      new (): SpeechRecognitionInstance;
    };
    webkitSpeechRecognition?: {
      new (): SpeechRecognitionInstance;
    };
  }
}

export interface SpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onEnd?: () => void;
}

export function useSpeechRecognition() {
  const { locale, t } = useI18n();
  const toast = useToast();

  const isSupported = ref<boolean>(typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  const isListening = ref<boolean>(false);
  const transcript = ref<string>('');
  const error = ref<string | null>(null);

  let recognition: SpeechRecognitionInstance | null = null;

  const getLanguageCode = (loc?: string): string => {
    const l = loc || locale.value;
    if (l === 'de') return 'de-DE';
    return 'en-US';
  };

  const startListening = (options: SpeechRecognitionOptions = {}) => {
    if (!isSupported.value) {
      toast.warning(t('speech.notSupported'));
      return;
    }

    if (isListening.value) {
      stopListening();
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      recognition = new SpeechRec();
      recognition.continuous = options.continuous ?? false;
      recognition.interimResults = options.interimResults ?? true;
      recognition.lang = options.lang || getLanguageCode();

      recognition.onstart = () => {
        isListening.value = true;
        error.value = null;
        transcript.value = '';
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let currentTranscript = '';
        let isFinalResult = false;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;
          currentTranscript += text;
          if (result.isFinal) {
            isFinalResult = true;
          }
        }

        transcript.value = currentTranscript;
        if (options.onResult) {
          options.onResult(currentTranscript, isFinalResult);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech') {
          // Silent timeout, not a critical error
          return;
        }
        if (event.error === 'not-allowed') {
          error.value = t('speech.permissionDenied');
          toast.error(t('speech.permissionDenied'));
        } else {
          error.value = event.message || event.error;
          toast.error(t('speech.error', { message: event.error }));
        }
      };

      recognition.onend = () => {
        isListening.value = false;
        if (options.onEnd) {
          options.onEnd();
        }
      };

      recognition.start();
    } catch (err: any) {
      isListening.value = false;
      const errMsg = err.message || 'Failed to start speech recognition';
      error.value = errMsg;
      toast.error(errMsg);
    }
  };

  const stopListening = () => {
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // Ignored if already stopped
      }
      recognition = null;
    }
    isListening.value = false;
  };

  const toggleListening = (options: SpeechRecognitionOptions = {}) => {
    if (isListening.value) {
      stopListening();
    } else {
      startListening(options);
    }
  };

  if (getCurrentInstance()) {
    onUnmounted(() => {
      stopListening();
    });
  }

  return {
    isSupported,
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
