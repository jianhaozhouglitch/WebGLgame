/**
 * AudioEngine.js
 * Procedural Web Audio API sound synthesizer for realistic car engine harmonics,
 * turbo blow-off valve, rev limiter pops, drift tire squeal, and wind rush.
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.masterVolume = 0.8;
    this.initialized = false;

    // Audio Nodes
    this.masterGain = null;
    this.engineGain = null;
    this.driftGain = null;
    this.windGain = null;

    // Engine Oscillators & Filter
    this.osc1 = null; // Sub-bass rumble
    this.osc2 = null; // Main firing frequency (cylinder strokes)
    this.osc3 = null; // High-rpm exhaust resonance
    this.engineFilter = null;

    // Drift noise
    this.driftNoiseNode = null;
    this.driftFilter = null;

    // Wind noise
    this.windNoiseNode = null;
    this.windFilter = null;

    // State tracking
    this.lastRpm = 900;
    this.lastThrottle = 0;
  }

  init() {
    if (this.initialized) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // --- Engine Synthesizer ---
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(400, this.ctx.currentTime);
      this.engineFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

      // Osc 1: Sub bass (sawtooth)
      this.osc1 = this.ctx.createOscillator();
      this.osc1.type = 'sawtooth';
      this.osc1.frequency.setValueAtTime(25, this.ctx.currentTime);

      // Osc 2: Cylinder combustion pulses (triangle)
      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = 'triangle';
      this.osc2.frequency.setValueAtTime(50, this.ctx.currentTime);

      // Osc 3: Exhaust rasp (square with lower gain)
      this.osc3 = this.ctx.createOscillator();
      this.osc3.type = 'sawtooth';
      this.osc3.frequency.setValueAtTime(75, this.ctx.currentTime);

      const osc3Gain = this.ctx.createGain();
      osc3Gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.osc3.connect(osc3Gain);

      this.osc1.connect(this.engineFilter);
      this.osc2.connect(this.engineFilter);
      osc3Gain.connect(this.engineFilter);

      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.osc1.start();
      this.osc2.start();
      this.osc3.start();

      // --- Drift Tire Screech Noise ---
      this.initDriftScreech();

      // --- High Speed Wind Noise ---
      this.initWindRush();

      this.initialized = true;

      // Resume context if suspended
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch (err) {
      console.warn('Web Audio initialization error:', err);
    }
  }

  initDriftScreech() {
    // Generate buffer of white noise
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.driftFilter = this.ctx.createBiquadFilter();
    this.driftFilter.type = 'bandpass';
    this.driftFilter.frequency.setValueAtTime(1100, this.ctx.currentTime);
    this.driftFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.setValueAtTime(0, this.ctx.currentTime);

    whiteNoise.connect(this.driftFilter);
    this.driftFilter.connect(this.driftGain);
    this.driftGain.connect(this.masterGain);

    whiteNoise.start();
  }

  initWindRush() {
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(250, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);

    whiteNoise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);

    whiteNoise.start();
  }

  /**
   * Update engine sound parameters in real-time
   * @param {number} rpm - 900 to 8600
   * @param {number} throttle - 0 to 1
   * @param {number} speedKmh - 0 to 320
   * @param {number} driftSlip - 0 to 1 (lateral slip)
   * @param {boolean} isRevLimiting - whether car is bouncing off redline
   */
  update(rpm, throttle, speedKmh, driftSlip, isRevLimiting = false) {
    if (!this.initialized || !this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;

    // 6-Cylinder Firing frequency formula: F = (RPM / 60) * (Cylinders / 2)
    // For 6-cyl: F = (RPM / 60) * 3 = RPM / 20.
    // e.g. 900 RPM -> 45 Hz base firing pulse
    // e.g. 8000 RPM -> 400 Hz firing pulse
    const baseFreq = Math.max(25, rpm / 22);

    this.osc1.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.03);
    this.osc2.frequency.setTargetAtTime(baseFreq, now, 0.03);
    this.osc3.frequency.setTargetAtTime(baseFreq * 2.0, now, 0.03);

    // Filter frequency opens up with throttle and rpm
    // Idle closed (350Hz) -> Wide Open Throttle high-rev (3800Hz)
    const targetFilterCutoff = 350 + (throttle * 1800) + (rpm / 8500) * 2200;
    this.engineFilter.frequency.setTargetAtTime(targetFilterCutoff, now, 0.04);

    // Engine volume: idle purr -> full roar
    let targetEngineVol = 0.25 + throttle * 0.45 + (rpm / 8500) * 0.3;
    if (isRevLimiting) {
      // Rapid stutter on redline limiter
      targetEngineVol = Math.random() > 0.5 ? 0.8 : 0.2;
    }
    this.engineGain.gain.setTargetAtTime(targetEngineVol, now, 0.03);

    // Drift squeal volume & frequency
    const squealVol = Math.min(1.0, Math.max(0, driftSlip * 1.4));
    this.driftGain.gain.setTargetAtTime(squealVol * 0.6, now, 0.05);
    const squealFreq = 900 + Math.min(speedKmh, 200) * 4;
    this.driftFilter.frequency.setTargetAtTime(squealFreq, now, 0.05);

    // High speed wind volume
    const windVol = Math.min(0.5, Math.pow(speedKmh / 280, 1.8) * 0.45);
    this.windGain.gain.setTargetAtTime(windVol, now, 0.08);
    this.windFilter.frequency.setTargetAtTime(200 + speedKmh * 3.5, now, 0.08);

    // Detect sudden throttle lift or shift -> trigger blow-off valve
    if (this.lastThrottle > 0.7 && throttle < 0.2 && rpm > 4000) {
      this.playTurboBlowOff();
    }

    this.lastRpm = rpm;
    this.lastThrottle = throttle;
  }

  /**
   * Sound effect: Turbo blow-off valve release "pssshh-tsu-tsu"
   */
  playTurboBlowOff() {
    if (!this.initialized || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.35;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.Q.setValueAtTime(3.0, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start(now);
    } catch (_) {}
  }

  /**
   * Sound effect: Exhaust backfire pop on redline cut or aggressive shift
   */
  playExhaustPop() {
    if (!this.initialized || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch (_) {}
  }

  /**
   * Sound effect: Gear shift mechanical clunk
   */
  playGearShiftSound() {
    if (!this.initialized || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.09);

      // Random chance of exhaust pop on shift
      if (Math.random() > 0.4) {
        this.playExhaustPop();
      }
    } catch (_) {}
  }

  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
    return !this.isMuted;
  }
}
