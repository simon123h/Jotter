import { computed, watch, ref } from 'vue';
import { useSpeechRecognition as useVueUseSpeechRecognition } from '@vueuse/core';
import { useI18n } from './useI18n';
import { useToast } from './useToast';

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

  const getLanguageCode = (loc?: string): string => {
    const l = loc || locale.value;
    if (l === 'de') return 'de-DE';
    return 'en-US';
  };

  const currentOptions = ref<SpeechRecognitionOptions>({});
  const lang = computed(() => currentOptions.value.lang || getLanguageCode());

  const vueUseSpeech = useVueUseSpeechRecognition({
    lang,
  });

  const isSupported = vueUseSpeech.isSupported;
  const isListening = vueUseSpeech.isListening;
  const transcript = vueUseSpeech.result;
  const error = ref<string | null>(null);

  watch(
    vueUseSpeech.result,
    (text) => {
      if (currentOptions.value.onResult) {
        currentOptions.value.onResult(text, true);
      }
    },
    { flush: 'sync' }
  );

  watch(
    vueUseSpeech.error,
    (err) => {
      if (!err) return;
      const errEvent = err as any;
      if (errEvent?.error === 'no-speech') return;
      if (errEvent?.error === 'not-allowed') {
        error.value = t('speech.permissionDenied');
        toast.error(t('speech.permissionDenied'));
      } else {
        const errMsg = errEvent?.message || errEvent?.error || 'Speech error';
        error.value = errMsg;
        toast.error(t('speech.error', { message: errEvent?.error || 'error' }));
      }
    },
    { flush: 'sync' }
  );

  watch(
    vueUseSpeech.isListening,
    (listening, prev) => {
      if (prev && !listening && currentOptions.value.onEnd) {
        currentOptions.value.onEnd();
      }
    },
    { flush: 'sync' }
  );

  const startListening = (options: SpeechRecognitionOptions = {}) => {
    if (!isSupported.value) {
      toast.warning(t('speech.notSupported'));
      return;
    }
    currentOptions.value = options;
    if (vueUseSpeech.recognition) {
      vueUseSpeech.recognition.lang = options.lang || getLanguageCode(options.lang);
      if (options.continuous !== undefined) vueUseSpeech.recognition.continuous = options.continuous;
      if (options.interimResults !== undefined) vueUseSpeech.recognition.interimResults = options.interimResults;
      vueUseSpeech.recognition.start();
    } else {
      vueUseSpeech.start();
    }
    vueUseSpeech.isListening.value = true;
  };

  const stopListening = () => {
    if (vueUseSpeech.recognition) {
      try {
        vueUseSpeech.recognition.stop();
      } catch {
        // Ignored
      }
    }
    vueUseSpeech.stop();
    vueUseSpeech.isListening.value = false;
  };

  const toggleListening = (options: SpeechRecognitionOptions = {}) => {
    if (isListening.value) {
      stopListening();
    } else {
      startListening(options);
    }
  };

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
