/**
 * Simple Web Audio API chime synthesizer for timer notifications.
 * Offline-first, lightweight, zero external sound assets.
 */
let audioCtx: AudioContext | null = null;

export function playPomodoroChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // Harmonic two-tone gentle chime: C5 (523.25 Hz) then G5 (783.99 Hz)
    const tones = [
      { freq: 523.25, start: 0.0, duration: 0.25 },
      { freq: 783.99, start: 0.15, duration: 0.45 },
    ];

    for (const tone of tones) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(tone.freq, now + tone.start);

      gain.gain.setValueAtTime(0.001, now + tone.start);
      gain.gain.exponentialRampToValueAtTime(0.2, now + tone.start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + tone.start + tone.duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now + tone.start);
      osc.stop(now + tone.start + tone.duration);
    }
  } catch {
    // Audio playback might fail on strict autoplay policies before user interaction
  }
}
