export const BPM = 96;
export const STEP_MS = (60_000 / BPM) / 2;

export const DRUM_PARTS = [
  { id: "crash", label: "Crash", short: "01", variant: "bandit" },
  { id: "hihat", label: "Hi-hat", short: "02", variant: "crown" },
  { id: "cymbal", label: "Cymbal", short: "03", variant: "miner" },
  { id: "midTom", label: "Mid tom", short: "04", variant: "buck" },
  { id: "ride", label: "Ride", short: "05", variant: "blush" },
  { id: "floorTom", label: "Floor tom", short: "06", variant: "glasses" },
  { id: "snare", label: "Snare", short: "07", variant: "camera" },
  { id: "bass", label: "Bass drum", short: "08", variant: "angry" },
];

const NOTE_MAP = {
  C2: 65.41,
  G1: 49.0,
  A1: 55.0,
  F1: 43.65,
  C4: 261.63,
  E4: 329.63,
  G4: 392.0,
  B3: 246.94,
  D4: 293.66,
  A3: 220.0,
  F3: 174.61,
};

const BASS_NOTES = ["C2", "G1", "A1", "F1"];
const PIANO_CHORDS = [
  ["C4", "E4", "G4"],
  ["G4", "B3", "D4"],
  ["A3", "C4", "E4"],
  ["F3", "A3", "C4"],
];
const GUITAR_RIFF = ["E4", "G4", "A3", "D4"];

export class AudioManager {
  constructor() {
    this.context = null;
    this.started = false;
    this.scheduler = null;
    this.nextTime = 0;
    this.sequenceStep = 0;
    this.noiseBuffer = null;
  }

  async start() {
    if (!this.context) {
      this.context = new window.AudioContext();
      this.noiseBuffer = this.createNoiseBuffer();
    }

    await this.context.resume();
    if (this.started) return;

    this.started = true;
    this.nextTime = this.context.currentTime + 0.08;
    this.sequenceStep = 0;
    this.scheduler = window.setInterval(() => this.scheduleLoop(), 30);
  }

  stop() {
    if (this.scheduler) {
      window.clearInterval(this.scheduler);
      this.scheduler = null;
    }
    this.started = false;
  }

  scheduleLoop() {
    if (!this.context || !this.started) return;
    const stepDuration = (60 / BPM) / 2;

    while (this.nextTime < this.context.currentTime + 0.15) {
      if (this.sequenceStep % 2 === 0) {
        this.playBassline(this.nextTime);
        this.playPiano(this.nextTime + 0.02);
        this.playGuitar(this.nextTime + 0.05);
      }

      this.sequenceStep += 1;
      this.nextTime += stepDuration;
    }
  }

  playDrum(id) {
    if (!this.context) return;
    const time = this.context.currentTime;
    const output = this.context.destination;

    switch (id) {
      case "crash":
        this.playMetal(time, 6500, 0.9, 0.28);
        break;
      case "hihat":
        this.playMetal(time, 9000, 0.08, 0.16);
        break;
      case "cymbal":
        this.playMetal(time, 7200, 0.5, 0.22);
        break;
      case "midTom":
        this.playTom(time, 180, 0.28);
        break;
      case "ride":
        this.playMetal(time, 5600, 0.42, 0.18);
        break;
      case "floorTom":
        this.playTom(time, 110, 0.42);
        break;
      case "snare":
        this.playSnare(time);
        break;
      case "bass":
        this.playKick(time, output);
        break;
      default:
        break;
    }
  }

  playBassline(time) {
    const note = BASS_NOTES[((this.sequenceStep / 2) % BASS_NOTES.length) | 0];
    this.playTone(time, NOTE_MAP[note], "triangle", 0.18, 0.2, -3);
  }

  playPiano(time) {
    const chord = PIANO_CHORDS[((this.sequenceStep / 2) % PIANO_CHORDS.length) | 0];
    chord.forEach((note, index) => {
      this.playTone(time + index * 0.01, NOTE_MAP[note], "triangle", 0.42, 0.045, 0);
    });
  }

  playGuitar(time) {
    const note = GUITAR_RIFF[((this.sequenceStep / 2) % GUITAR_RIFF.length) | 0];
    this.playTone(time, NOTE_MAP[note], "sawtooth", 0.12, 0.06, -4);
    this.playTone(time + 0.01, NOTE_MAP[note] * 2, "square", 0.08, 0.035, 6);
  }

  playTone(time, frequency, type, decay, gainValue, detune) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);
    osc.detune.setValueAtTime(detune, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(gainValue, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    osc.connect(gain).connect(this.context.destination);
    osc.start(time);
    osc.stop(time + decay + 0.05);
  }

  playMetal(time, cutoff, decay, gainValue) {
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    filter.type = "highpass";
    filter.frequency.setValueAtTime(cutoff, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(gainValue, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    source.connect(filter).connect(gain).connect(this.context.destination);
    source.start(time);
    source.stop(time + decay + 0.02);
  }

  playTom(time, baseFreq, decay) {
    this.playTone(time, baseFreq, "sine", decay, 0.32, 0);
    this.playTone(time, baseFreq * 0.5, "triangle", decay + 0.05, 0.12, 0);
  }

  playSnare(time) {
    this.playTone(time, 210, "triangle", 0.17, 0.18, 0);
    this.playMetal(time, 2800, 0.2, 0.18);
  }

  playKick(time, destination) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(130, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.1);
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);

    osc.connect(gain).connect(destination);
    osc.start(time);
    osc.stop(time + 0.18);
  }

  createNoiseBuffer() {
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 0.5, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }

    return buffer;
  }
}
