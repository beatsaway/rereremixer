// Snare Drum Module
class SnareDrum {
    static parameterNames = {
        noiseLevel: { label: 'Noise Level', min: 0, max: 100, step: 1, default: 80 },
        oscLevel: { label: 'Oscillator Level', min: 0, max: 100, step: 1, default: 50 },
        oscFreq: { label: 'Oscillator Frequency', min: 100, max: 1000, step: 10, default: 180 },
        duration: { label: 'Duration', min: 50, max: 300, step: 10, default: 120 },
        volume: { label: 'Volume', min: 0, max: 1, step: 0.01, default: 0.7 }
    };

    constructor(params = {}) {
        this.audioContext = null;
        this.initAudio();
        
        // Default parameters
        this.params = {
            noiseLevel: params.noiseLevel || 80,
            oscLevel: params.oscLevel || 50,
            oscFreq: params.oscFreq || 180,
            duration: params.duration || 120,
            volume: params.volume || 0.7
        };
    }

    initAudio() {
        // Handle Safari
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();
    }

    createNoiseBuffer() {
        const bufferSize = this.audioContext.sampleRate * 2;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        return buffer;
    }

    play() {
        const now = this.audioContext.currentTime;
        
        // Read parameter values from instance
        const noiseLevel = this.params.noiseLevel / 100;
        const oscLevel = this.params.oscLevel / 100;
        const oscFreq = this.params.oscFreq;
        const duration = this.params.duration / 1000;
        const volume = this.params.volume;
        
        // Create master gain node for volume control
        const masterGain = this.audioContext.createGain();
        masterGain.gain.value = volume;
        masterGain.connect(this.audioContext.destination);
        
        // Create the noise component
        const noiseBuffer = this.createNoiseBuffer();
        const noiseSource = this.audioContext.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        
        // Create a bandpass filter for the noise
        const noiseFilter = this.audioContext.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 4000;
        noiseFilter.Q.value = 1;
        
        // Create gain node for noise component
        const noiseGain = this.audioContext.createGain();
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.linearRampToValueAtTime(noiseLevel, now + 0.005);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        // Create oscillator component
        const osc = this.audioContext.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = oscFreq;
        
        // Create gain node for oscillator component
        const oscGain = this.audioContext.createGain();
        oscGain.gain.setValueAtTime(0, now);
        oscGain.gain.linearRampToValueAtTime(oscLevel, now + 0.005);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.6);
        
        // Connect the noise path
        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(masterGain);
        
        // Connect the oscillator path
        osc.connect(oscGain);
        oscGain.connect(masterGain);
        
        // Start and stop
        noiseSource.start(now);
        osc.start(now);
        
        noiseSource.stop(now + duration + 0.1);
        osc.stop(now + duration + 0.1);
    }
}

// Make SnareDrum available globally
window.SnareDrum = SnareDrum; 