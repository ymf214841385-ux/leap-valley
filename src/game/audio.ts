export class GameAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfx: GainNode | null = null;
  music: GainNode | null = null;
  muted = false;
  private musicTimer = 0;
  private musicOn = false;
  private step = 0;
  private theme = 0;
  private nodes: Array<{ osc?: OscillatorNode; src?: AudioBufferSourceNode; g: GainNode }> = [];

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx.gain.value = 0.7;
      this.music.gain.value = 0.11;
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyMute();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyMute();
  }

  private applyMute() {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  resumeIfNeeded() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  suspendMusic() {
    this.musicOn = false;
  }

  destroy() {
    this.musicOn = false;
    for (const n of this.nodes) {
      try {
        n.osc?.disconnect();
        n.src?.disconnect();
        n.g.disconnect();
      } catch {
        /* already gone */
      }
    }
    this.nodes = [];
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.music = null;
  }

  private beep(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0) {
    if (!this.ctx || !this.sfx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    this.nodes.push({ osc, g });
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
      this.nodes = this.nodes.filter((n) => n.osc !== osc);
    };
  }

  private noise(dur: number, vol: number) {
    if (!this.ctx || !this.sfx || this.muted) return;
    const t = this.ctx.currentTime;
    const n = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = n.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = n;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + dur);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
      f.disconnect();
    };
  }

  jump() { this.beep(420 + Math.random() * 18, 0.09, "square", 0.075, 180); }
  coin(streak = 1) {
    const bump = Math.min(7, streak - 1) * 40;
    this.beep(980 + bump, 0.06, "square", 0.065);
    this.beep(1320 + bump, 0.1, "square", 0.055, 0, 0.04);
  }
  stomp() { this.noise(0.08, 0.16); this.beep(180, 0.1, "triangle", 0.09, -80); }
  bump() { this.beep(160, 0.06, "square", 0.055); }
  hurt() { this.beep(320, 0.18, "sawtooth", 0.085, -200); }
  power() {
    this.beep(523, 0.08, "square", 0.065);
    this.beep(659, 0.1, "square", 0.065, 0, 0.08);
    this.beep(784, 0.16, "square", 0.07, 0, 0.16);
  }
  checkpoint() {
    this.beep(660, 0.1, "triangle", 0.06);
    this.beep(880, 0.16, "triangle", 0.07, 0, 0.1);
  }
  win() {
    this.beep(523, 0.12, "triangle", 0.07);
    this.beep(659, 0.12, "triangle", 0.07, 0, 0.12);
    this.beep(784, 0.12, "triangle", 0.07, 0, 0.24);
    this.beep(1046, 0.28, "triangle", 0.09, 0, 0.36);
  }
  death() { this.beep(300, 0.35, "sawtooth", 0.075, -220); }
  land() { this.noise(0.04, 0.07); }
  glide() { this.beep(520, 0.14, "triangle", 0.045, -60); }
  secret() {
    this.beep(740, 0.1, "square", 0.06);
    this.beep(980, 0.16, "triangle", 0.07, 0, 0.08);
  }

  setMusic(on: boolean, theme = 0) {
    this.musicOn = on;
    this.musicTimer = 0;
    this.step = 0;
    this.theme = theme;
  }

  tick(dt: number) {
    if (!this.musicOn || !this.ctx || this.muted || !this.music) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = this.theme === 2 ? 0.36 : 0.32;
    const scales = [
      [392, 440, 523, 587, 659, 523, 440, 392],
      [349, 392, 440, 523, 587, 440, 392, 349],
      [330, 392, 494, 523, 659, 494, 392, 330],
    ];
    const scale = scales[this.theme] ?? scales[0]!;
    const freq = scale[this.step % scale.length]!;
    this.step += 1;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.04, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.connect(g);
    g.connect(this.music);
    osc.start(t);
    osc.stop(t + 0.28);
    osc.onended = () => { osc.disconnect(); g.disconnect(); };
  }
}
