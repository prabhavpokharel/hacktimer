/* ============================================================
   HACKATHON TIMER — js/sounds.js
   Sound engine: 3 events only
     1. pitchEnd      — loud alarm when 4-min pitch timer hits 0
     2. oneMinWarning — urgent warning at 1 min remaining
     3. transition    — continuous Kahoot-style loop during shift
   Supports: built-in synth OR user-uploaded audio file per slot
   ============================================================ */

const SoundEngine = (() => {
  let _ctx = null;

  // ── AudioContext (lazy init on first user gesture) ──────────────────────────
  function ctx() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    return _ctx;
  }

  // ── Low-level helpers ───────────────────────────────────────────────────────
  function osc(freq, type, startTime, dur, vol, freqEndVal) {
    try {
      const c = ctx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = type; o.frequency.value = freq;
      if (freqEndVal !== undefined) o.frequency.linearRampToValueAtTime(freqEndVal, startTime + dur);
      g.gain.setValueAtTime(vol, startTime);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
      o.start(startTime); o.stop(startTime + dur + 0.01);
    } catch(e) {}
  }

  function now() { return ctx().currentTime; }

  // ── Built-in synth sounds ───────────────────────────────────────────────────

  // 1. PITCH END ALARM — three blasting buzzer pulses
  function synthPitchEnd(vol) {
    const v = vol;
    const t = now();
    // Three pulses 350ms apart
    [0, 0.35, 0.70].forEach(off => {
      osc(200, 'sawtooth', t + off,       0.28, v * 0.65);
      osc(880, 'square',   t + off,       0.28, v * 0.30);
      osc(160, 'sawtooth', t + off + 0.1, 0.18, v * 0.45);
    });
  }

  // 2. ONE-MINUTE WARNING — urgent rising siren × 3
  function synthOneMinWarning(vol) {
    const v = vol;
    const t = now();
    [0, 0.55, 1.1].forEach(off => {
      osc(380, 'sawtooth', t + off, 0.45, v * 0.55, 820);
      osc(950, 'sine',     t + off, 0.45, v * 0.18, 950);
    });
  }

  // 3. TRANSITION LOOP — Kahoot-style upbeat melody, designed to loop cleanly
  //    Returns a stop function; call it to end the loop.
  function synthTransitionLoop(vol) {
    const v = vol;
    // Melody: [freq, beat_offset_in_8ths, dur_in_8ths]  (one 8th = 0.18s @ ~165bpm feel)
    const BEAT = 0.17; // seconds per 8th note
    const LOOP = 16;   // 16 eighth notes per loop cycle (~2.7s)
    const melody = [
      [523, 0,  1.2], [659, 1,  1.2], [784, 2,  1.2],
      [1047,3,  1.5], [880, 4,  1.2], [784, 5,  1.2],
      [659, 6,  1.2], [784, 7,  1.2], [880, 8,  1.2],
      [1047,9,  1.5], [880, 10, 1.2], [784, 11, 1.2],
      [659, 12, 1.2], [523, 13, 1.2], [659, 14, 1.5],
      [784, 15, 2.0],
    ];
    const bass = [0, 4, 8, 12]; // bass kick on these beats

    let running = true;
    let iteration = 0;

    function scheduleLoop() {
      if (!running) return;
      const baseTime = now() + 0.05;
      melody.forEach(([freq, beat, durBeats]) => {
        osc(freq, 'triangle', baseTime + beat * BEAT, durBeats * BEAT * 0.82, v * 0.32);
      });
      bass.forEach(beat => {
        // Bass thud
        try {
          const c = ctx();
          const o = c.createOscillator(), g = c.createGain();
          o.connect(g); g.connect(c.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(110, baseTime + beat * BEAT);
          o.frequency.exponentialRampToValueAtTime(40, baseTime + beat * BEAT + 0.12);
          g.gain.setValueAtTime(v * 0.28, baseTime + beat * BEAT);
          g.gain.exponentialRampToValueAtTime(0.001, baseTime + beat * BEAT + 0.18);
          o.start(baseTime + beat * BEAT);
          o.stop(baseTime + beat * BEAT + 0.22);
        } catch(e) {}
      });
      iteration++;
      // Schedule next loop just before current ends
      setTimeout(scheduleLoop, (LOOP * BEAT * 1000) - 80);
    }

    scheduleLoop();
    return function stop() { running = false; };
  }

  // ── Custom audio file playback ──────────────────────────────────────────────
  //    Each slot stores: { mode: 'synth'|'file', buffer: AudioBuffer|null, vol: 0-1 }

  const slots = {
    pitchEnd:      { mode: 'synth', buffer: null, vol: 0.8, loop: false },
    oneMinWarning: { mode: 'synth', buffer: null, vol: 0.7, loop: false },
    transition:    { mode: 'synth', buffer: null, vol: 0.6, loop: true  },
  };

  // Load an uploaded file into a slot's buffer
  async function loadFile(slotKey, file) {
    const ab = await file.arrayBuffer();
    const buffer = await ctx().decodeAudioData(ab);
    slots[slotKey].buffer = buffer;
    slots[slotKey].mode = 'file';
    return buffer;
  }

  // Play a buffered file once or looping
  function playBuffer(buffer, vol, loop) {
    try {
      const c = ctx();
      const src = c.createBufferSource();
      const gain = c.createGain();
      src.connect(gain); gain.connect(c.destination);
      src.buffer = buffer;
      src.loop = !!loop;
      gain.gain.value = vol;
      src.start();
      return src; // caller can call src.stop() to end loop
    } catch(e) { return null; }
  }

  // ── Active transition source (so we can stop it) ────────────────────────────
  let _transitionStop = null; // for synth loop
  let _transitionSrc  = null; // for file loop

  // ── Public API ──────────────────────────────────────────────────────────────
  return {
    // Call on first user interaction to unlock AudioContext
    unlock() { ctx(); },

    setMode(slotKey, mode) { slots[slotKey].mode = mode; },
    setVol(slotKey, vol)   { slots[slotKey].vol  = parseFloat(vol); },
    getSlot(slotKey)       { return slots[slotKey]; },
    loadFile,

    playPitchEnd() {
      const s = slots.pitchEnd;
      if (s.mode === 'file' && s.buffer) { playBuffer(s.buffer, s.vol, false); return; }
      synthPitchEnd(s.vol);
    },

    playOneMinWarning() {
      const s = slots.oneMinWarning;
      if (s.mode === 'file' && s.buffer) { playBuffer(s.buffer, s.vol, false); return; }
      synthOneMinWarning(s.vol);
    },

    startTransition() {
      this.stopTransition(); // ensure clean slate
      const s = slots.transition;
      if (s.mode === 'file' && s.buffer) {
        _transitionSrc = playBuffer(s.buffer, s.vol, true);
      } else {
        _transitionStop = synthTransitionLoop(s.vol);
      }
    },

    stopTransition() {
      if (_transitionStop) { _transitionStop(); _transitionStop = null; }
      if (_transitionSrc)  { try { _transitionSrc.stop(); } catch(e) {} _transitionSrc = null; }
    },

    // Preview any slot for UI testing
    preview(slotKey) {
      if (slotKey === 'transition') {
        this.startTransition();
        setTimeout(() => this.stopTransition(), 3000);
      } else if (slotKey === 'pitchEnd') {
        this.playPitchEnd();
      } else if (slotKey === 'oneMinWarning') {
        this.playOneMinWarning();
      }
    },
  };
})();
