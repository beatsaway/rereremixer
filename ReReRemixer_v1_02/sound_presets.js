// Sound Presets
const soundPresets = {
    kick: [
        {
            name: "Thunder Strike",
            params: {
                initialFreq: 265,
                freqDecay: 193,
                duration: 500,
                clickLevel: 42,
                clickDuration: 40,
                volume: 0.7
            }
        },
        {
            name: "Abyssal Pulse",
            params: {
                initialFreq: 185,
                freqDecay: 474,
                duration: 700,
                clickLevel: 11,
                clickDuration: 59,
                volume: 0.7
            }
        },
        {
            name: "Sonic Boom",
            params: {
                initialFreq: 218,
                freqDecay: 324,
                duration: 300,
                clickLevel: 36,
                clickDuration: 31,
                volume: 0.7
            }
        },
        {
            name: "Cosmic Impact",
            params: {
                initialFreq: 238,
                freqDecay: 200,
                duration: 500,
                clickLevel: 11,
                clickDuration: 37,
                volume: 0.7
            }
        }
    ],
    snare: [
        {
            name: "Crystal Shard",
            params: {
                noiseLevel: 97,
                oscLevel: 81,
                oscFreq: 250,
                duration: 120,
                volume: 0.7
            }
        },
        {
            name: "Echo Chamber",
            params: {
                noiseLevel: 80,
                oscLevel: 50,
                oscFreq: 180,
                duration: 120,
                volume: 0.7
            }
        },
        {
            name: "Quantum Snap",
            params: {
                noiseLevel: 36,
                oscLevel: 87,
                oscFreq: 156,
                duration: 80,
                volume: 0.7
            }
        },
        {
            name: "Time Warp",
            params: {
                noiseLevel: 56,
                oscLevel: 20,
                oscFreq: 170,
                duration: 270,
                volume: 0.7
            }
        }
    ],
    bass: [
        {
            name: "Nebula Core",
            params: {
                attackFreq: 109,
                subFreq: 63,
                pitchDecay: 55,
                subDecay: 590,
                bodyPunch: 42,
                clickLevel: 53,
                midRangeBoost: 0.33,
                transientSharpness: 59,
                volume: 0.7
            }
        },
        {
            name: "Void Resonance",
            params: {
                attackFreq: 58,
                subFreq: 46,
                pitchDecay: 55,
                subDecay: 590,
                bodyPunch: 34,
                clickLevel: 36,
                midRangeBoost: 0.49,
                transientSharpness: 89,
                volume: 0.7
            }
        },
        {
            name: "Dark Matter",
            params: {
                attackFreq: 58,
                subFreq: 37,
                pitchDecay: 89,
                subDecay: 730,
                bodyPunch: 18,
                clickLevel: 51,
                midRangeBoost: 0.49,
                transientSharpness: 89,
                volume: 0.7
            }
        },
        {
            name: "Solar Flare",
            params: {
                attackFreq: 85,
                subFreq: 42,
                pitchDecay: 45,
                subDecay: 450,
                bodyPunch: 65,
                clickLevel: 28,
                midRangeBoost: 0.42,
                transientSharpness: 75,
                volume: 0.7
            }
        }
    ],
    clap: [
        {
            name: "Starlight Burst",
            params: {
                spacing: 8,
                decay: 48,
                reverbDecay: 850,
                filterFreq: 1860,
                filterQ: 0.2,
                volume: 0.7
            }
        },
        {
            name: "Aurora Wave",
            params: {
                spacing: 29,
                decay: 146,
                reverbDecay: 420,
                filterFreq: 1440,
                filterQ: 0.1,
                volume: 0.7
            }
        },
        {
            name: "Moonlight Echo",
            params: {
                spacing: 12,
                decay: 93,
                reverbDecay: 580,
                filterFreq: 1440,
                filterQ: 0.1,
                volume: 0.7
            }
        },
        {
            name: "Meteor Shower",
            params: {
                spacing: 8,
                decay: 127,
                reverbDecay: 210,
                filterFreq: 1440,
                filterQ: 0.1,
                volume: 0.7
            }
        },
        {
            name: "Galactic Snap",
            params: {
                spacing: 10,
                decay: 60,
                reverbDecay: 500,
                filterFreq: 3000,
                filterQ: 0.1,
                volume: 0.7
            }
        }
    ],
    hihat: [
        {
            name: "Quantum Spark",
            params: {
                freq1: 8000,
                freq2: 10000,
                duration: 60,
                release: 30,
                filterFreq: 5000,
                filterQ: 1,
                volume: 0.5
            }
        },
        {
            name: "Photon Beam",
            params: {
                freq1: 7200,
                freq2: 11200,
                duration: 91,
                release: 30,
                filterFreq: 5700,
                filterQ: 1,
                volume: 0.5
            }
        },
        {
            name: "Shadow Pulse",
            params: {
                freq1: 6100,
                freq2: 8700,
                duration: 43,
                release: 30,
                filterFreq: 6300,
                filterQ: 1,
                volume: 0.5
            }
        },
        {
            name: "Time Ripple",
            params: {
                freq1: 11500,
                freq2: 14600,
                duration: 119,
                release: 90,
                filterFreq: 3600,
                filterQ: 1,
                volume: 0.5
            }
        },
        {
            name: "Space Dust",
            params: {
                freq1: 11900,
                freq2: 14200,
                duration: 88,
                release: 20,
                filterFreq: 3100,
                filterQ: 1,
                volume: 0.5
            }
        }
    ]
};

// Make soundPresets available globally
window.soundPresets = soundPresets; 