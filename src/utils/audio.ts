/**
 * Hospital Notification Chimes Engine
 * Uses Web Audio API oscillator nodes for lightweight, zero-dependency audible feedback.
 */

/**
 * Play gentle hospital chime tones
 */
export function playChimeSound(type: 'call' | 'new-patient' | 'success' | 'warning' | 'overload' = 'call'): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }
      const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      if (!AudioContext) {
        resolve();
        return;
      }

      const ctx = new AudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      if (type === 'overload' || type === 'warning') {
        // High-low gentle two-tone hospital alert (A5 -> F5 -> A5)
        const notes = [
          { freq: 880.0, time: 0.0, duration: 0.18 },
          { freq: 698.46, time: 0.20, duration: 0.18 },
          { freq: 880.0, time: 0.40, duration: 0.25 },
        ];
        notes.forEach((note) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(note.freq, now + note.time);

          gain.gain.setValueAtTime(0.3, now + note.time);
          gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.duration);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + note.time);
          osc.stop(now + note.time + note.duration);
        });
        setTimeout(() => resolve(), 700);
      } else if (type === 'call') {
        // Hospital Announcement Chime (Ding-Dong / G4 - C5 - E5)
        const frequencies = [392.00, 523.25, 659.25];
        frequencies.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + index * 0.22);

          gain.gain.setValueAtTime(0.35, now + index * 0.22);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.22 + 0.85);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + index * 0.22);
          osc.stop(now + index * 0.22 + 0.85);
        });

        setTimeout(() => resolve(), 750);
      } else if (type === 'new-patient') {
        // Crisp 3-tone hospital incoming alert chime (E5 -> A5 -> C#6)
        const notes = [
          { freq: 659.25, time: 0.0, dur: 0.35, gain: 0.28 },
          { freq: 880.00, time: 0.12, dur: 0.40, gain: 0.30 },
          { freq: 1108.73, time: 0.24, dur: 0.55, gain: 0.32 }
        ];
        notes.forEach((note) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(note.freq, now + note.time);

          gain.gain.setValueAtTime(note.gain, now + note.time);
          gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.dur);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + note.time);
          osc.stop(now + note.time + note.dur);
        });
        setTimeout(() => resolve(), 600);
      } else if (type === 'success') {
        // Pleasant tri-tone
        [523.25, 659.25, 783.99].forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + index * 0.1);

          gain.gain.setValueAtTime(0.2, now + index * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.1 + 0.45);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + index * 0.1);
          osc.stop(now + index * 0.1 + 0.45);
        });
        setTimeout(() => resolve(), 450);
      } else {
        resolve();
      }
    } catch (err) {
      console.warn('Web Audio chime error:', err);
      resolve();
    }
  });
}
