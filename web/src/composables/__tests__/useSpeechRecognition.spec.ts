import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSpeechRecognition } from '../useSpeechRecognition';

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = 'en-US';
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((ev: any) => void) | null = null;
  onresult: ((ev: any) => void) | null = null;

  constructor() {
    MockSpeechRecognition.instance = this;
  }

  static instance: MockSpeechRecognition | null = null;
}

describe('useSpeechRecognition composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    MockSpeechRecognition.instance = null;
    (window as any).SpeechRecognition = MockSpeechRecognition;
  });

  afterEach(() => {
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;
  });

  it('detects browser support correctly', () => {
    const { isSupported } = useSpeechRecognition();
    expect(isSupported.value).toBe(true);
  });

  it('starts listening and updates reactive state', () => {
    const { isListening, startListening } = useSpeechRecognition();
    startListening({ lang: 'de-DE' });

    const instance = MockSpeechRecognition.instance!;
    expect(instance.lang).toBe('de-DE');
    expect(instance.start).toHaveBeenCalled();

    // Trigger onstart
    instance.onstart?.();
    expect(isListening.value).toBe(true);
  });

  it('handles speech recognition result callbacks', () => {
    const onResult = vi.fn();
    const { startListening, transcript } = useSpeechRecognition();
    startListening({ onResult });

    const instance = MockSpeechRecognition.instance!;
    instance.onstart?.();

    // Mock speech event
    const mockEvent = {
      resultIndex: 0,
      results: [
        {
          0: { transcript: 'Refactor login auth' },
          isFinal: true,
          length: 1,
        },
      ],
    };

    instance.onresult?.(mockEvent);

    expect(transcript.value).toBe('Refactor login auth');
    expect(onResult).toHaveBeenCalledWith('Refactor login auth', true);
  });

  it('stops listening cleanly on stopListening or onend', () => {
    const { isListening, startListening, stopListening } = useSpeechRecognition();
    startListening();
    const instance = MockSpeechRecognition.instance!;
    instance.onstart?.();
    expect(isListening.value).toBe(true);

    stopListening();
    expect(instance.stop).toHaveBeenCalled();
    expect(isListening.value).toBe(false);
  });
});
