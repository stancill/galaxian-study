// audio.js — WebAudio synthesis of the original discrete sound board:
// shoot sweep (shoot enable latch), LFSR noise pops/explosions (noise enable),
// dive warble (LFO freq bits: 139 Hz +/- 139/3), quiet background hum.
// All synthesized from documented circuit behavior; no samples.
"use strict";

class SoundBoard {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.warble = null;
    this.hum = null;
  }

  _ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
    return !!this.ctx;
  }

  resume() { if (this._ensure() && this.ctx.state === "suspended") this.ctx.resume(); }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  _noiseBuffer(seconds) {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, rate*seconds, rate);
    const d = buf.getChannelData(0);
    // 17-bit LFSR-ish noise, like the discrete RNG flavor
    let g = 0x7fff;
    for (let i = 0; i < d.length; i++) {
      const bit = (((~g >>> 16) & 1) ^ ((g >>> 4) & 1));
      g = ((g << 1) | bit) & 0x1ffff;
      d[i] = (g & 1 ? 1 : -1) * 0.6;
    }
    return buf;
  }

  fire() {                                   // player shot: the laser zap.
    // original board generates the shot from a dedicated sweep generator
    // (MAME: shoot rate 2672 Hz) — long exponential fall, slight sub layer
    if (!this._ensure()) return;
    const t = this.ctx.currentTime;
    for (const [type, mul, gain] of [["sawtooth", 1, 0.2], ["square", 0.5, 0.07]]) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(2500 * mul, t);
      o.frequency.exponentialRampToValueAtTime(140 * mul, t + 0.38);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.42);
    }
  }

  pop() {                                    // alien kill: tight noise snap
    if (!this._ensure()) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.12);
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.setValueAtTime(1500, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.1); f.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  shipBoom() {                               // player death: thump + long fall
    if (!this._ensure()) return;
    const t = this.ctx.currentTime;
    // low thump
    const o = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    og.gain.setValueAtTime(0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(og); og.connect(this.master);
    o.start(t); o.stop(t + 0.32);
    // long noise fall
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(1.4);
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(800, t);
    f.frequency.exponentialRampToValueAtTime(45, t + 1.3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  diveStart() {                              // dive warble: LFO'd tone
    if (!this._ensure() || this.warble) return;
    const o = this.ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = 139;
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine"; lfo.frequency.value = 7;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 46;                 // +/- 139/3, per the LFO bits
    lfo.connect(lfoGain); lfoGain.connect(o.frequency);
    const g = this.ctx.createGain();
    g.gain.value = 0.055;
    o.connect(g); g.connect(this.master);
    o.start(); lfo.start();
    this.warble = { o, lfo, g };
  }

  divePitch(level) {                         // raise pitch as divers descend
    if (this.warble) this.warble.o.frequency.value = 139 + level * 30;
  }

  diveStop() {
    if (!this.warble) return;
    const { o, lfo } = this.warble;
    o.stop(); lfo.stop();
    this.warble = null;
  }

  extraLife() {                              // bonus galaxip jingle
    if (!this._ensure()) return;
    const t = this.ctx.currentTime;
    [660, 880, 1320].forEach((fq, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "square"; o.frequency.value = fq;
      g.gain.setValueAtTime(0.12, t + i*0.12);
      g.gain.exponentialRampToValueAtTime(0.001, t + i*0.12 + 0.11);
      o.connect(g); g.connect(this.master);
      o.start(t + i*0.12); o.stop(t + i*0.12 + 0.12);
    });
  }

  coin() {                                   // start blip
    if (!this._ensure()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square"; o.frequency.value = 1560;
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.1);
  }

  humOn() {                                  // quiet background hum
    if (!this._ensure() || this.hum) return;
    const o = this.ctx.createOscillator();
    o.type = "square"; o.frequency.value = 55;
    const g = this.ctx.createGain();
    g.gain.value = 0.012;
    o.connect(g); g.connect(this.master);
    o.start();
    this.hum = { o, g };
  }

  humOff() {
    if (!this.hum) return;
    this.hum.o.stop();
    this.hum = null;
  }
}
