# Simple Piano Remixer

A web-based audio remixer that allows you to record or upload audio and create remixes with customizable note durations and audio envelopes.

## Features

### Audio Recording & Playback
- Record audio directly from your microphone
- Upload audio files (supports various audio formats)
- Visual waveform display with playhead animation

### Remix Controls
- **BPM Control**: Adjust the tempo from 60-200 BPM
- **Note Duration Probabilities**: Set the probability of different note durations (1/16, 1/8, 1/4, 1/2, etc.)
- **Audio Envelope**: Control the attack and delay of each audio slice

### Audio Envelope Controls

#### Attack Slider (0-1000ms)
- Controls how quickly each audio slice fades in
- **0ms**: Instant start (no fade-in)
- **1000ms**: Gradual fade-in over 1 second
- Higher values create smoother, more musical transitions

#### Delay Slider (0-1000ms)
- Controls how quickly each audio slice fades out
- **0ms**: Instant stop (no fade-out)
- **1000ms**: Gradual fade-out over 1 second **beyond** the note duration
- The fade-out starts when the slice ends and continues for the delay duration
- Higher values create overlapping, ambient sounds as notes blend together

### How It Works
1. Record or upload an audio file
2. Adjust the BPM to set the tempo
3. Set note duration probabilities (total must equal 100%)
4. Adjust attack and delay values for desired envelope
5. Click "Start Remix" to begin the automated remix
6. The system will randomly select slices of your audio based on the probabilities and apply the envelope settings

### Tips for Best Results
- **Attack**: Use higher values (200-500ms) for smoother, more musical transitions
- **Delay**: Use higher values (300-800ms) for ambient, atmospheric effects with note overlap
- **BPM**: Match the BPM to your original audio for more coherent remixes
- **Note Durations**: Mix different durations for more dynamic remixes
- **Overlap Effects**: Higher delay values create lush, overlapping textures

## Technical Details
- Uses Web Audio API for real-time audio processing
- Gain nodes control the envelope (attack/delay)
- Canvas-based waveform visualization
- Responsive design with modern CSS
