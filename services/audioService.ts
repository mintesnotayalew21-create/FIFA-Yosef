class AudioService {
  private ctx: AudioContext | null = null;
  private bgmOscillators: OscillatorNode[] = [];
  private gainNode: GainNode | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Initialized on first user interaction
  }

  public init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.ctx.createGain();
      this.gainNode.connect(this.ctx.destination);
      this.gainNode.gain.value = 0.3; // Master volume
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playKick() {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  public playGoal() {
    if (!this.ctx || this.isMuted) return;
    
    // Crowd cheer simulation (filtered noise)
    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  public playWhistle() {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(2500, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(2000, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  public startBGM() {
    if (!this.ctx || this.isMuted) return;
    // Simple rhythmic bassline
    const playNote = (freq: number, time: number, dur: number) => {
       if (!this.ctx) return;
       const osc = this.ctx.createOscillator();
       const gain = this.ctx.createGain();
       osc.frequency.value = freq;
       osc.type = 'sine';
       gain.gain.value = 0.1;
       gain.gain.exponentialRampToValueAtTime(0.01, time + dur);
       osc.connect(gain);
       gain.connect(this.ctx.destination);
       osc.start(time);
       osc.stop(time + dur);
    };

    // Loop logic would go here, but for simplicity we just play an ambient drone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = 50; // Low drone
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    this.bgmOscillators.push(osc);
  }

  public stopBGM() {
    this.bgmOscillators.forEach(o => o.stop());
    this.bgmOscillators = [];
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if(this.gainNode && this.ctx) {
        this.gainNode.gain.value = this.isMuted ? 0 : 0.3;
    }
    return this.isMuted;
  }
}

export const audioService = new AudioService();
