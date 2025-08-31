// Global variables
let mediaRecorder;
let audioChunks = [];
let audioContext;
let audioBuffer = null;
let isRecording = false;
let mediaStream;
let currentSource = null;
let isRemixing = false;
let remixInterval = null;
let currentRemixIndex = 0;
let remixSequence = [];
let playheadPosition = 0;
let playheadAnimationId = null;
let activeNoteIndicators = {};
let delayPhaseIndicators = {};
let scheduledTimeouts = [];
let nextSequenceTimeout = null;
let masterGainNode = null;
let activePreset = 'chop'; // Track which preset is currently active
let cleanupInterval = null; // Interval for periodic cleanup
let isHolding = false; // Track if hold button is being held
let holdInterval = null; // Interval for continuous note playback during hold
let backgroundSource = null; // Background loop source (Layer 2)
let backgroundGain = null; // Background gain node for Layer 2
let remixGain = null; // Remix gain node for Layer 1

// DOM elements
const recordToggleBtn = document.getElementById('recordToggleBtn');
const playBtn = document.getElementById('playBtn');
const holdBtn = document.getElementById('holdBtn');
const statusDiv = document.getElementById('status');
const permissionMessage = document.getElementById('permissionMessage');
const canvas = document.getElementById('visualizer');
const canvasContext = canvas.getContext('2d');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const bpmSlider = document.getElementById('bpmSlider');
const bpmValue = document.getElementById('bpmValue');
const attackSlider = document.getElementById('attackSlider');
const attackValue = document.getElementById('attackValue');
const delaySlider = document.getElementById('delaySlider');
const delayValue = document.getElementById('delayValue');
const masterVolumeSlider = document.getElementById('masterVolumeSlider');
const masterVolumeValue = document.getElementById('masterVolumeValue');
const layerMixSlider = document.getElementById('layerMixSlider');
const layerMixValue = document.getElementById('layerMixValue');
const remixControls = document.getElementById('remixControls');
const totalProbability = document.getElementById('totalProbability');
const resetProbabilities = document.getElementById('resetProbabilities');

// Resize canvas to fill container
function resizeCanvas() {
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
}

// Initialize audio context
function initializeAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create master gain node
        masterGainNode = audioContext.createGain();
        masterGainNode.connect(audioContext.destination);
        
        // Set initial master volume (default to 100% if slider not available yet)
        const masterVolume = masterVolumeSlider ? parseInt(masterVolumeSlider.value) / 100 : 1;
        masterGainNode.gain.setValueAtTime(masterVolume, audioContext.currentTime);
    }
}

// Start recording
function startRecording() {
    if (!mediaStream) {
        recordToggleBtn.textContent = 'Waiting for permission...';
        recordToggleBtn.disabled = true;
        
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                mediaStream = stream;
                initializeRecording(stream);
            })
            .catch(err => {
                permissionMessage.classList.remove('hidden');
                console.error('Error accessing microphone:', err);
                recordToggleBtn.textContent = 'Start Recording';
                recordToggleBtn.disabled = false;
            });
    } else {
        initializeRecording(mediaStream);
    }
}

function initializeRecording(stream) {
    const options = { mimeType: 'audio/webm' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/ogg';
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = '';
        }
    }
    
    mediaRecorder = new MediaRecorder(stream, options);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = () => {
        let blobType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunks, { type: blobType });
        
        // Convert to audio buffer
        const reader = new FileReader();
        reader.onload = () => {
            initializeAudioContext();
            audioContext.decodeAudioData(reader.result, buffer => {
                audioBuffer = buffer;
                visualizeAudio(buffer);
                statusDiv.textContent = 'Recording complete! Click Play to hear it.';
                playBtn.disabled = false;
                holdBtn.disabled = false;
            });
        };
        reader.readAsArrayBuffer(audioBlob);
    };
    
    mediaRecorder.start();
    isRecording = true;
    recordToggleBtn.classList.add('recording');
    recordToggleBtn.textContent = 'Stop Recording';
    recordToggleBtn.disabled = false;
    statusDiv.textContent = 'Recording... Click Stop when done.';
}

// Stop recording
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording = false;
        recordToggleBtn.classList.remove('recording');
        recordToggleBtn.textContent = 'Start Recording';
        statusDiv.textContent = 'Processing recording...';
    }
}

// Calculate duration in milliseconds based on note value and BPM
function calculateDuration(noteValue, bpm) {
    const beatDuration = 60000 / bpm; // milliseconds per beat
    
    switch (noteValue) {
        case '1/16': return beatDuration / 4;
        case '1/16T': return (beatDuration / 4) * (4/3); // extended note
        case '1/12': return beatDuration / 3;
        case '1/12T': return (beatDuration / 3) * (4/3); // extended note
        case '1/8': return beatDuration / 2;
        case '1/8T': return (beatDuration / 2) * (4/3); // extended note
        case '1/4': return beatDuration;
        case '1/4T': return beatDuration * (4/3); // extended note
        case '1/2': return beatDuration * 2;
        case '1/2T': return (beatDuration * 2) * (4/3); // extended note
        default: return beatDuration;
    }
}

// Get probability-weighted random note
function getRandomNoteByProbability() {
    const sliders = document.querySelectorAll('.probability-slider input[type="range"]:not(.repeat-slider)');
    const notes = [];
    const probabilities = [];
    
    // Collect all notes and their probabilities
    sliders.forEach(slider => {
        const note = slider.dataset.note;
        const probability = parseInt(slider.value);
        if (probability > 0) {
            notes.push(note);
            probabilities.push(probability);
        }
    });
    
    if (notes.length === 0) {
        return null;
    }
    
    // Generate random number between 0 and total probability
    const total = probabilities.reduce((sum, prob) => sum + prob, 0);
    const random = Math.random() * total;
    
    // Find which note this random number corresponds to
    let cumulative = 0;
    for (let i = 0; i < probabilities.length; i++) {
        cumulative += probabilities[i];
        if (random <= cumulative) {
            return notes[i];
        }
    }
    
    // Fallback to last note
    return notes[notes.length - 1];
}



// Generate remix sequence
function generateRemixSequence() {
    const bpm = parseInt(bpmSlider.value);
    
    // Check if any note has probability > 0
    const sliders = document.querySelectorAll('.probability-slider input[type="range"]');
    const hasValidNotes = Array.from(sliders).some(slider => parseInt(slider.value) > 0);
    
    if (!hasValidNotes) {
        alert('Please set at least one note duration probability above 0!');
        return null;
    }
    
    // Generate a sequence of 128 random durations based on probabilities
    const sequence = [];
    for (let i = 0; i < 128; i++) {
        const randomDuration = getRandomNoteByProbability();
        if (randomDuration) {
            const durationMs = calculateDuration(randomDuration, bpm);
            sequence.push({
                noteValue: randomDuration,
                durationMs: durationMs
            });
        }
    }
    
    return sequence;
}

// Update remix sequence with new probabilities
function updateRemixSequence() {
    const newSequence = generateRemixSequence();
    if (newSequence) {
        remixSequence = newSequence;
        
        // If currently remixing, reschedule all notes with new sequence
        if (isRemixing) {
            // Clear any existing intervals
            if (remixInterval) {
                clearInterval(remixInterval);
                remixInterval = null;
            }
            
            // Reschedule all notes with new sequence
            scheduleAllNotes();
        }
        
        // Update status to show the new sequence
        if (remixSequence.length > 0) {
            statusDiv.textContent = `Remix updated! Current: ${remixSequence[currentRemixIndex].noteValue} (${currentRemixIndex + 1}/16)`;
        }
        
        // Update visual indicators
        updateNoteIndicators();
    }
}

// Update existing sequence with new BPM (recalculate durations without changing note types)
function updateSequenceWithNewBPM() {
    if (!remixSequence || remixSequence.length === 0) return;
    
    const newBPM = parseInt(bpmSlider.value);
    
    // Recalculate durations for existing note types
    remixSequence.forEach(note => {
        note.durationMs = calculateDuration(note.noteValue, newBPM);
    });
    
    // If currently remixing, reschedule all notes with new timing
    if (isRemixing) {
        // Clear any existing intervals
        if (remixInterval) {
            clearInterval(remixInterval);
            remixInterval = null;
        }
        
        // Reschedule all notes with new timing
        scheduleAllNotes();
    }
    
    // Update status
    if (remixSequence.length > 0) {
        statusDiv.textContent = `BPM updated! Current: ${remixSequence[currentRemixIndex].noteValue} (${currentRemixIndex + 1}/16)`;
    }
}

// Update visual indicators for active note durations
function updateNoteIndicators() {
    // Reset all indicators
    const sliders = document.querySelectorAll('.probability-slider');
    sliders.forEach(slider => {
        slider.classList.remove('active-note');
        slider.classList.remove('current-note');
        slider.classList.remove('delay-phase');
    });
    
    if (!isRemixing || remixSequence.length === 0) {
        return;
    }
    
    // Get all unique note types in the current sequence
    const activeNotes = new Set();
    remixSequence.forEach(note => {
        activeNotes.add(note.noteValue);
    });
    
    // Highlight all active notes
    sliders.forEach(slider => {
        const noteValue = slider.querySelector('input').dataset.note;
        if (activeNotes.has(noteValue)) {
            slider.classList.add('active-note');
        }
    });
    
    // Highlight the current note being played
    if (currentRemixIndex < remixSequence.length) {
        const currentNote = remixSequence[currentRemixIndex].noteValue;
        sliders.forEach(slider => {
            const noteValue = slider.querySelector('input').dataset.note;
            if (noteValue === currentNote) {
                slider.classList.add('current-note');
            }
        });
    }
    
    // Highlight notes in delay phase
    Object.keys(delayPhaseIndicators).forEach(index => {
        const delayInfo = delayPhaseIndicators[index];
        const noteValue = delayInfo.noteValue;
        
        sliders.forEach(slider => {
            const sliderNoteValue = slider.querySelector('input').dataset.note;
            if (sliderNoteValue === noteValue) {
                slider.classList.add('delay-phase');
            }
        });
    });
}

// Play a random slice of the audio
function playRandomSlice() {
    if (!audioBuffer || !audioContext) return;
    
    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    // If hold mode is active, reuse the current slice position instead of generating a new random one
    let startSample;
    if (isHolding && currentRemixIndex > 0) {
        // Reuse the previous slice position to extend the current note
        startSample = window.lastSliceStartSample || Math.floor(Math.random() * (audioBuffer.length - (audioBuffer.sampleRate * 0.5)));
    } else {
        // Calculate random start position (leave some buffer at the end)
        const maxStart = audioBuffer.length - (audioBuffer.sampleRate * 0.5); // 0.5 second buffer
        startSample = Math.floor(Math.random() * maxStart);
        // Store the current slice position for potential hold reuse
        window.lastSliceStartSample = startSample;
    }
    
    // Calculate slice duration (use the current sequence duration)
    const sliceDurationMs = remixSequence[currentRemixIndex].durationMs;
    const sliceDurationSamples = Math.floor((sliceDurationMs / 1000) * audioBuffer.sampleRate);
    const endSample = Math.min(startSample + sliceDurationSamples, audioBuffer.length);
    
    // Create a new buffer with just the selected slice
    const sliceBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        endSample - startSample,
        audioBuffer.sampleRate
    );
    
    // Copy the audio data
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const oldData = audioBuffer.getChannelData(channel);
        const newData = sliceBuffer.getChannelData(channel);
        for (let i = 0; i < newData.length; i++) {
            newData[i] = oldData[i + startSample];
        }
    }
    
    // Get envelope values
    const attackTime = parseInt(attackSlider.value) / 1000; // Convert to seconds
    const delayTime = parseInt(delaySlider.value) / 1000; // Convert to seconds
    
    // Create gain node for envelope control
    const gainNode = audioContext.createGain();
    // Connect to remix gain node if it exists, otherwise to master gain
    const targetGain = remixGain || masterGainNode;
    gainNode.connect(targetGain);
    
    // Play the slice
    const source = audioContext.createBufferSource();
    source.buffer = sliceBuffer;
    source.connect(gainNode);
    
    // Apply envelope
    const now = audioContext.currentTime;
    
    // Set default volume to -16dB to prevent clipping
    gainNode.gain.setValueAtTime(0.158, now); // -16dB = 10^(-16/20) ≈ 0.158
    const sliceDuration = sliceBuffer.duration;
    
    // Set initial gain to 0 for attack
    gainNode.gain.setValueAtTime(0, now);
    
    // Attack phase - fade in
    if (attackTime > 0) {
        gainNode.gain.linearRampToValueAtTime(0.158, now + attackTime); // -16dB
    } else {
        gainNode.gain.setValueAtTime(0.158, now); // -16dB
    }
    
    // Delay phase - fade out (extending beyond note duration)
    if (delayTime > 0) {
        // Start fade out at the slice end and continue beyond it
        gainNode.gain.setValueAtTime(0.158, now + sliceDuration); // -16dB
        gainNode.gain.linearRampToValueAtTime(0, now + sliceDuration + delayTime);
    }
    
    source.start();
    
    currentSource = source;
    
    // Track delay phase for visual indication
    if (delayTime > 0) {
        const delayEndTime = now + sliceDuration + delayTime;
        const delayStartTime = now + sliceDuration;
        
        // Add to delay phase indicators with a unique ID
        const delayId = `delay_${Date.now()}_${Math.random()}`;
        delayPhaseIndicators[delayId] = {
            startTime: delayStartTime,
            endTime: delayEndTime,
            noteValue: remixSequence[currentRemixIndex].noteValue
        };
        
        // Remove from delay phase when it ends
        const delayTimeoutId = setTimeout(() => {
            delete delayPhaseIndicators[delayId];
            updateNoteIndicators();
        }, (delayEndTime - now) * 1000);
        
        // Track this timeout for cleanup
        scheduledTimeouts.push(delayTimeoutId);
    }
    
    // Stop any existing playhead animation
    if (playheadAnimationId) {
        cancelAnimationFrame(playheadAnimationId);
        playheadAnimationId = null;
    }
    
    // Set playhead to show where this slice is playing
    const startTime = startSample / audioBuffer.sampleRate;
    const duration = sliceDurationSamples / audioBuffer.sampleRate;
    
    // For remix mode, show where this slice is playing
    if (isRemixing) {
        const startPosition = (startTime / audioBuffer.duration) * canvas.width;
        const endPosition = ((startTime + duration) / audioBuffer.duration) * canvas.width;
        
        // Set initial position
        playheadPosition = startPosition;
        visualizeAudio(audioBuffer);
        
        // Animate the playhead across the slice duration
        const distance = endPosition - startPosition;
        const animationStartTime = performance.now();
        
        function updateRemixPlayhead(currentTime) {
            const elapsed = currentTime - animationStartTime;
            const progress = Math.min(elapsed / (duration * 1000), 1);
            
            playheadPosition = startPosition + (distance * progress);
            visualizeAudio(audioBuffer);
            
            if (progress < 1) {
                playheadAnimationId = requestAnimationFrame(updateRemixPlayhead);
            }
        }
        
        playheadAnimationId = requestAnimationFrame(updateRemixPlayhead);
    } else {
        // For normal playback, use the original animation
        animatePlayhead(startTime, duration);
    }
    
    // Update status
    statusDiv.textContent = `Remixing... ${remixSequence[currentRemixIndex].noteValue} (${currentRemixIndex + 1}/128)`;
    
    // Update visual indicators
    updateNoteIndicators();
}

// Start background loop (Layer 2)
function startBackgroundLoop() {
    if (!audioBuffer || !audioContext) return;
    
    // Create gain node for background audio (Layer 2)
    backgroundGain = audioContext.createGain();
    backgroundGain.connect(masterGainNode);
    
    // Create gain node for remix audio (Layer 1)
    remixGain = audioContext.createGain();
    remixGain.connect(masterGainNode);
    
    // Set initial volumes based on layer mix slider
    const layerMix = layerMixSlider ? parseInt(layerMixSlider.value) / 100 : 0;
    backgroundGain.gain.setValueAtTime(layerMix, audioContext.currentTime);
    remixGain.gain.setValueAtTime(1 - layerMix, audioContext.currentTime);
    
    // Create and start background source
    backgroundSource = audioContext.createBufferSource();
    backgroundSource.buffer = audioBuffer;
    backgroundSource.connect(backgroundGain);
    backgroundSource.loop = true; // Enable looping
    backgroundSource.start();
}

// Stop background loop (Layer 2)
function stopBackgroundLoop() {
    if (backgroundSource) {
        backgroundSource.stop();
        backgroundSource = null;
    }
    if (backgroundGain) {
        backgroundGain.disconnect();
        backgroundGain = null;
    }
    if (remixGain) {
        remixGain.disconnect();
        remixGain = null;
    }
}

// Start remix
function startRemix() {
    if (!audioBuffer || !audioContext) return;
    
    // Stop any currently playing audio
    if (currentSource) {
        currentSource.stop();
    }
    
    // Generate new remix sequence
    remixSequence = generateRemixSequence();
    if (!remixSequence) return;
    
    // Start background loop (Layer 2)
    startBackgroundLoop();
    
    isRemixing = true;
    currentRemixIndex = 0;
    playBtn.textContent = 'Stop Remix';
    playBtn.classList.remove('play-button');
    playBtn.classList.add('stop-button');
    holdBtn.disabled = false; // Enable hold button during remix
    
    // Clear any existing intervals
    if (remixInterval) {
        clearInterval(remixInterval);
        remixInterval = null;
    }
    
    // Schedule all notes independently
    scheduleAllNotes();
    
    // Start periodic cleanup interval
    cleanupInterval = setInterval(cleanupCompletedEvents, 1000); // Clean up every second
    
    // Update visual indicators
    updateNoteIndicators();
}

// Schedule all notes as independent events with proper cleanup
function scheduleAllNotes() {
    // Clear any existing timeouts
    clearAllScheduledTimeouts();
    delayPhaseIndicators = {};
    
    const now = audioContext.currentTime;
    let currentTime = now;
    
    // Schedule each note with its own timeout
    for (let i = 0; i < remixSequence.length; i++) {
        const note = remixSequence[i];
        const noteDuration = note.durationMs / 1000; // Convert to seconds
        const delayTime = parseInt(delaySlider.value) / 1000; // Get delay time
        
        // Schedule this note to play at currentTime
        const timeoutId = setTimeout(() => {
            if (isRemixing) {
                currentRemixIndex = i;
                playRandomSlice();
                updateNoteIndicators();
                
                // Schedule cleanup after the note + delay time
                const cleanupTimeoutId = setTimeout(() => {
                    // Remove this timeout from tracking array
                    const index = scheduledTimeouts.indexOf(timeoutId);
                    if (index > -1) {
                        scheduledTimeouts.splice(index, 1);
                    }
                    
                    // Remove cleanup timeout from tracking
                    const cleanupIndex = scheduledTimeouts.indexOf(cleanupTimeoutId);
                    if (cleanupIndex > -1) {
                        scheduledTimeouts.splice(cleanupIndex, 1);
                    }
                    
                    // Update status
                    if (isRemixing) {
                        statusDiv.textContent = `Remixing... (Note ${currentRemixIndex + 1}/${remixSequence.length}, ${scheduledTimeouts.length} events active)`;
                    }
                }, (noteDuration + delayTime) * 1000);
                
                // Track cleanup timeout
                scheduledTimeouts.push(cleanupTimeoutId);
            }
        }, (currentTime - now) * 1000);
        
        // Track this timeout for cleanup
        scheduledTimeouts.push(timeoutId);
        
        // Move to next note time (allows overlap due to delay)
        currentTime += noteDuration;
    }
    
    // Schedule the next sequence after the first one completes
    nextSequenceTimeout = setTimeout(() => {
        if (isRemixing) {
            scheduleNextSequence();
        }
        nextSequenceTimeout = null;
    }, (currentTime - now) * 1000);
}

// Schedule the next sequence (separate function to avoid recursive clearing)
function scheduleNextSequence() {
    if (!isRemixing) return;
    
    // Generate new sequence and continue
    remixSequence = generateRemixSequence();
    if (remixSequence) {
        scheduleAllNotes();
    }
}

// Clear all scheduled timeouts
function clearAllScheduledTimeouts() {
    // Clear all note timeouts
    scheduledTimeouts.forEach(timeoutId => {
        clearTimeout(timeoutId);
    });
    scheduledTimeouts = [];
    
    // Clear next sequence timeout
    if (nextSequenceTimeout) {
        clearTimeout(nextSequenceTimeout);
        nextSequenceTimeout = null;
    }
    
    // Update status to show cleanup
    if (isRemixing) {
        statusDiv.textContent = `Remixing... (${scheduledTimeouts.length} events scheduled)`;
    }
}

// Periodic cleanup function to remove completed events
function cleanupCompletedEvents() {
    // Update status with current progress and active events
    if (isRemixing) {
        const progress = currentRemixIndex + 1;
        const total = remixSequence ? remixSequence.length : 0;
        statusDiv.textContent = `Remixing... (Note ${progress}/${total}, ${scheduledTimeouts.length} events active)`;
    }
}

// Stop remix
function stopRemix() {
    isRemixing = false;
    if (remixInterval) {
        clearInterval(remixInterval);
        remixInterval = null;
    }
    if (currentSource) {
        currentSource.stop();
        currentSource = null;
    }
    
    // Stop background loop (Layer 2)
    stopBackgroundLoop();
    
    // Stop playhead animation
    stopPlayheadAnimation();
    
    // Clear cleanup interval
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
    
    // Clear all scheduled timeouts
    clearAllScheduledTimeouts();
    
    // Clear delay phase indicators
    delayPhaseIndicators = {};
    
    // Clear visual indicators
    updateNoteIndicators();
    
    playBtn.textContent = 'Start Remix';
    playBtn.classList.remove('stop-button');
    playBtn.classList.add('play-button');
    holdBtn.disabled = false; // Re-enable hold button after remix stops
    statusDiv.textContent = 'Remix stopped.';
}

// Start hold mode - extend current note duration
function startHold() {
    if (!audioBuffer || !audioContext || isHolding || !isRemixing) return;
    
    isHolding = true;
    holdBtn.classList.add('holding');
    holdBtn.textContent = 'Holding...';
    
    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    // Start continuous playback of the current slice
    const bpm = parseInt(bpmSlider.value);
    const noteDuration = calculateDuration('1/8', bpm); // Use 1/8 note timing for hold repeats
    const intervalMs = noteDuration;
    
    holdInterval = setInterval(() => {
        if (isHolding && isRemixing) {
            // Play the same slice repeatedly while holding
            playRandomSlice();
        }
    }, intervalMs);
    
    statusDiv.textContent = 'Hold mode active - extending current note';
}

// Stop hold mode
function stopHold() {
    if (!isHolding) return;
    
    isHolding = false;
    holdBtn.classList.remove('holding');
    holdBtn.textContent = 'Hold';
    
    // Clear hold interval
    if (holdInterval) {
        clearInterval(holdInterval);
        holdInterval = null;
    }
    
    if (isRemixing) {
        statusDiv.textContent = 'Remixing... (Note ' + (currentRemixIndex + 1) + '/' + remixSequence.length + ', ' + scheduledTimeouts.length + ' events active)';
    } else {
        statusDiv.textContent = 'Hold mode stopped';
    }
}

// Play audio (original function, now used as fallback)
function playAudio() {
    if (!audioBuffer || !audioContext) return;
    
    // Stop any currently playing audio
    if (currentSource) {
        currentSource.stop();
    }
    
    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    // Get envelope values
    const attackTime = parseInt(attackSlider.value) / 1000; // Convert to seconds
    const delayTime = parseInt(delaySlider.value) / 1000; // Convert to seconds
    
    // Create gain node for envelope control
    const gainNode = audioContext.createGain();
    gainNode.connect(masterGainNode);
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);
    
    // Apply envelope
    const now = audioContext.currentTime;
    
    // Set default volume to -16dB to prevent clipping
    gainNode.gain.setValueAtTime(0.158, now); // -16dB = 10^(-16/20) ≈ 0.158
    const audioDuration = audioBuffer.duration;
    
    // Set initial gain to 0 for attack
    gainNode.gain.setValueAtTime(0, now);
    
    // Attack phase - fade in
    if (attackTime > 0) {
        gainNode.gain.linearRampToValueAtTime(0.158, now + attackTime); // -16dB
    } else {
        gainNode.gain.setValueAtTime(0.158, now); // -16dB
    }
    
    // Delay phase - fade out (extending beyond audio duration)
    if (delayTime > 0) {
        // Start fade out at the audio end and continue beyond it
        gainNode.gain.setValueAtTime(0.158, now + audioDuration); // -16dB
        gainNode.gain.linearRampToValueAtTime(0, now + audioDuration + delayTime);
    }
    
    source.start();
    
    currentSource = source;
    statusDiv.textContent = 'Playing audio...';
    
    // Animate playhead for full audio playback
    animatePlayhead(0, audioBuffer.duration);
    
    source.onended = () => {
        statusDiv.textContent = 'Audio finished playing.';
        currentSource = null;
        stopPlayheadAnimation();
    };
}

// Visualize audio waveform
function visualizeAudio(buffer) {
    const data = buffer.getChannelData(0);
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Downsample the data for visualization
    const maxPoints = canvas.width;
    const step = Math.max(1, Math.floor(data.length / maxPoints));
    const downsampledData = [];
    
    for (let i = 0; i < data.length; i += step) {
        // Calculate RMS (Root Mean Square) for this segment to get average amplitude
        let sum = 0;
        let count = 0;
        for (let j = 0; j < step && i + j < data.length; j++) {
            sum += data[i + j] * data[i + j];
            count++;
        }
        const rms = Math.sqrt(sum / count);
        downsampledData.push(rms);
    }
    
    // Draw waveform
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2ecc71';
    ctx.beginPath();
    
    const sliceWidth = canvas.width / downsampledData.length;
    let x = 0;
    
    for (let i = 0; i < downsampledData.length; i++) {
        const v = downsampledData[i];
        const y = (v * canvas.height / 2) + canvas.height / 2;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
    }
    
    ctx.stroke();
    
    // Add a mirror waveform for better visual effect
    ctx.strokeStyle = 'rgba(46, 204, 113, 0.3)';
    ctx.beginPath();
    x = 0;
    
    for (let i = 0; i < downsampledData.length; i++) {
        const v = downsampledData[i];
        const y = canvas.height - ((v * canvas.height / 2) + canvas.height / 2);
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
    }
    
    ctx.stroke();
    
    // Draw playhead
    drawPlayhead();
}

// Draw playhead indicator
function drawPlayhead() {
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    
    // Draw playhead line
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(playheadPosition, 0);
    ctx.lineTo(playheadPosition, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw playhead circle
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(playheadPosition, canvas.height / 2, 6, 0, 2 * Math.PI);
    ctx.fill();
    
    // Add glow effect
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(playheadPosition, canvas.height / 2, 8, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.shadowBlur = 0;
}

// Animate playhead
function animatePlayhead(startTime, duration) {
    const canvas = document.getElementById('visualizer');
    const startPosition = (startTime / audioBuffer.duration) * canvas.width;
    const endPosition = (startTime + duration) / audioBuffer.duration * canvas.width;
    const distance = endPosition - startPosition;
    
    playheadPosition = startPosition;
    
    function updatePlayhead(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        playheadPosition = startPosition + (distance * progress);
        
        // Redraw waveform with playhead
        visualizeAudio(audioBuffer);
        
        if (progress < 1) {
            playheadAnimationId = requestAnimationFrame(updatePlayhead);
        } else {
            // Don't reset to 0, let the next slice set its own position
            if (!isRemixing) {
                playheadPosition = 0;
                visualizeAudio(audioBuffer);
            }
        }
    }
    
    playheadAnimationId = requestAnimationFrame(updatePlayhead);
}

// Stop playhead animation
function stopPlayheadAnimation() {
    if (playheadAnimationId) {
        cancelAnimationFrame(playheadAnimationId);
        playheadAnimationId = null;
    }
    playheadPosition = 0;
    if (audioBuffer) {
        visualizeAudio(audioBuffer);
    }
}

// Handle file upload
function handleFileUpload(file) {
    if (!file.type.startsWith('audio/')) {
        statusDiv.textContent = 'Please select an audio file.';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
        initializeAudioContext();
        audioContext.decodeAudioData(reader.result, buffer => {
            audioBuffer = buffer;
            visualizeAudio(buffer);
            statusDiv.textContent = 'Audio loaded! Click Play to hear it.';
            playBtn.disabled = false;
            holdBtn.disabled = false;
        });
    };
    reader.readAsArrayBuffer(file);
}

// Event listeners
recordToggleBtn.addEventListener('click', () => {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
});

playBtn.addEventListener('click', () => {
    if (isRemixing) {
        stopRemix();
    } else {
        startRemix();
    }
});

// Hold button event listeners
holdBtn.addEventListener('mousedown', () => {
    if (audioBuffer && isRemixing && !isHolding) {
        startHold();
    }
});

holdBtn.addEventListener('mouseup', () => {
    if (isHolding) {
        stopHold();
    }
});

holdBtn.addEventListener('mouseleave', () => {
    if (isHolding) {
        stopHold();
    }
});

// Touch events for mobile devices
holdBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (audioBuffer && isRemixing && !isHolding) {
        startHold();
    }
});

holdBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (isHolding) {
        stopHold();
    }
});

// BPM slider event listener
bpmSlider.addEventListener('input', (e) => {
    bpmValue.textContent = e.target.value;
    
    // Update duration values
    updateDurationValues();
    
    // Update remix sequence if currently remixing
    if (isRemixing && remixSequence.length > 0) {
        updateSequenceWithNewBPM();
    }
});

// Update duration values based on current BPM
function updateDurationValues() {
    const bpm = parseInt(bpmSlider.value);
    const noteTypes = ['1/16', '1/16T', '1/12', '1/12T', '1/8', '1/8T', '1/4', '1/4T', '1/2', '1/2T'];
    
    noteTypes.forEach(noteType => {
        const duration = calculateDuration(noteType, bpm);
        const msElements = document.querySelectorAll(`[data-note="${noteType}"]`).forEach(slider => {
            const label = slider.parentElement.querySelector('label');
            const msValue = label.querySelector('.ms-value');
            if (msValue) {
                msValue.textContent = duration.toFixed(1);
            }
        });
    });
}

// Envelope slider event listeners
attackSlider.addEventListener('input', (e) => {
    attackValue.textContent = e.target.value;
});

delaySlider.addEventListener('input', (e) => {
    delayValue.textContent = e.target.value;
});

// Master volume slider event listener
masterVolumeSlider.addEventListener('input', (e) => {
    masterVolumeValue.textContent = e.target.value;
    
    // Update master gain node if audio context exists
    if (masterGainNode && audioContext) {
        const masterVolume = parseInt(e.target.value) / 100;
        masterGainNode.gain.setValueAtTime(masterVolume, audioContext.currentTime);
    }
});

// Layer mix slider event listener
layerMixSlider.addEventListener('input', (e) => {
    layerMixValue.textContent = e.target.value;
    
    // Update layer mix if gain nodes exist
    if (backgroundGain && remixGain && audioContext) {
        const layerMix = parseInt(e.target.value) / 100;
        // Layer 1 (remix) gets (1 - layerMix) volume, Layer 2 (background) gets layerMix volume
        const backgroundVolume = layerMix;
        const remixVolume = 1 - layerMix;
        
        backgroundGain.gain.setValueAtTime(backgroundVolume, audioContext.currentTime);
        remixGain.gain.setValueAtTime(remixVolume, audioContext.currentTime);
    }
});

// Probability constraint system
function updateTotalProbability() {
    const sliders = document.querySelectorAll('.probability-slider input[type="range"]');
    const total = Array.from(sliders).reduce((sum, slider) => sum + parseInt(slider.value), 0);
    totalProbability.textContent = total;
    
    // Update visual feedback
    sliders.forEach(slider => {
        const value = parseInt(slider.value);
        const label = slider.parentElement.querySelector('label');
        const probValue = label.querySelector('.prob-value');
        probValue.textContent = value;
        
        // Disable slider if total would exceed 100
        const otherSliders = Array.from(sliders).filter(s => s !== slider);
        const otherTotal = otherSliders.reduce((sum, s) => sum + parseInt(s.value), 0);
        const maxAllowed = 100 - otherTotal;
        
        if (value > maxAllowed) {
            slider.style.opacity = '0.5';
        } else {
            slider.style.opacity = '1';
        }
    });
}

// Update active preset visual state
function updateActivePreset(presetName) {
    // Remove active class from all preset buttons
    const presetButtons = document.querySelectorAll('.reset-btn, .chop-btn, .shuffle-btn, .swing-btn, .break-btn, .dub-btn, .slow-btn');
    presetButtons.forEach(btn => {
        btn.classList.remove('active-preset');
    });
    
    // Add active class to the current preset button
    const activeButton = document.getElementById(presetName + 'Button') || document.getElementById('resetProbabilities');
    if (activeButton) {
        activeButton.classList.add('active-preset');
    }
    
    // Update the active preset variable
    activePreset = presetName;
}

function constrainProbability(changedSlider) {
    const sliders = document.querySelectorAll('.probability-slider input[type="range"]');
    const currentValue = parseInt(changedSlider.value);
    
    // Calculate total of other sliders
    const otherSliders = Array.from(sliders).filter(s => s !== changedSlider);
    const otherTotal = otherSliders.reduce((sum, slider) => sum + parseInt(slider.value), 0);
    
    // If total would exceed 100, reduce the changed slider
    if (currentValue + otherTotal > 100) {
        const maxAllowed = 100 - otherTotal;
        changedSlider.value = Math.max(0, maxAllowed);
    }
    
    updateTotalProbability();
    
    // Update remix sequence if currently remixing
    if (isRemixing && remixSequence.length > 0) {
        updateRemixSequence();
    }
}

function resetToEqualProbabilities() {
    const sliders = document.querySelectorAll('.probability-slider input[type="range"]');
    const equalValue = Math.floor(100 / sliders.length);
    const remainder = 100 % sliders.length;
    
    sliders.forEach((slider, index) => {
        const value = equalValue + (index < remainder ? 1 : 0);
        slider.value = value;
    });
    
    updateTotalProbability();
    
    // Update remix sequence if currently remixing
    if (isRemixing && remixSequence.length > 0) {
        updateRemixSequence();
    }
}

// Probability slider event listeners
document.querySelectorAll('.probability-slider input[type="range"]').forEach(slider => {
    slider.addEventListener('input', (e) => {
        constrainProbability(e.target);
    });
});

// Reset button event listener
resetProbabilities.addEventListener('click', () => {
    resetToEqualProbabilities();
    updateActivePreset('reset');
});

// Chop button event listener
document.getElementById('chopButton').addEventListener('click', () => {
    // Set 1/16 to 100% and all others to 0%
    const sliders = document.querySelectorAll('.probability-slider input[type="range"]');
    sliders.forEach(slider => {
        if (slider.dataset.note === '1/16') {
            slider.value = 100;
        } else {
            slider.value = 0;
        }
        // Update the displayed value
        const label = slider.parentElement.querySelector('label');
        const probValue = label.querySelector('.prob-value');
        probValue.textContent = slider.value;
    });
    updateTotalProbability();
    
    // Update remix sequence if currently remixing
    if (isRemixing && remixSequence.length > 0) {
        updateRemixSequence();
    }
    
    updateActivePreset('chop');
});

// Shuffle button event listener (50% 1/16T, 50% 1/4)
document.getElementById('shuffleButton').addEventListener('click', () => {
    const sliders = document.querySelectorAll('.probability-slider input[type="range"]');
    sliders.forEach(slider => {
        if (slider.dataset.note === '1/16T') {
            slider.value = 50;
        } else if (slider.dataset.note === '1/4') {
            slider.value = 50;
        } else {
            slider.value = 0;
        }
        // Update the displayed value
        const label = slider.parentElement.querySelector('label');
        const probValue = label.querySelector('.prob-value');
        probValue.textContent = slider.value;
    });
    updateTotalProbability();
    
    if (isRemixing && remixSequence.length > 0) {
        updateRemixSequence();
    }
    
    updateActivePreset('shuffle');
});

// Swing button event listener (40% 1/8, 30% 1/8T, 30% 1/4T)
document.getElementById('swingButton').addEventListener('click', () => {
    const sliders = document.querySelectorAll('.probability-slider input[type="range"]');
    sliders.forEach(slider => {
        if (slider.dataset.note === '1/8') {
            slider.value = 40;
        } else if (slider.dataset.note === '1/8T') {
            slider.value = 30;
        } else if (slider.dataset.note === '1/4T') {
            slider.value = 30;
        } else {
            slider.value = 0;
        }
        // Update the displayed value
        const label = slider.parentElement.querySelector('label');
        const probValue = label.querySelector('.prob-value');
        probValue.textContent = slider.value;
    });
    updateTotalProbability();
    
    if (isRemixing && remixSequence.length > 0) {
        updateRemixSequence();
    }
    
    updateActivePreset('swing');
});

// Break button event listener (60% 1/4, 25% 1/8, 15% 1/16)
document.getElementById('breakButton').addEventListener('click', () => {
    const sliders = document.querySelectorAll('.probability-slider input[type="range"]');
    sliders.forEach(slider => {
        if (slider.dataset.note === '1/4') {
            slider.value = 60;
        } else if (slider.dataset.note === '1/8') {
            slider.value = 25;
        } else if (slider.dataset.note === '1/16') {
            slider.value = 15;
        } else {
            slider.value = 0;
        }
        // Update the displayed value
        const label = slider.parentElement.querySelector('label');
        const probValue = label.querySelector('.prob-value');
        probValue.textContent = slider.value;
    });
    updateTotalProbability();
    
    if (isRemixing && remixSequence.length > 0) {
        updateRemixSequence();
    }
    
    updateActivePreset('break');
});

// Dub button event listener (70% 1/2, 20% 1/4, 10% 1/8)
document.getElementById('dubButton').addEventListener('click', () => {
    const sliders = document.querySelectorAll('.probability-slider input[type="range"]');
    sliders.forEach(slider => {
        if (slider.dataset.note === '1/2') {
            slider.value = 70;
        } else if (slider.dataset.note === '1/4') {
            slider.value = 20;
        } else if (slider.dataset.note === '1/8') {
            slider.value = 10;
        } else {
            slider.value = 0;
        }
        // Update the displayed value
        const label = slider.parentElement.querySelector('label');
        const probValue = label.querySelector('.prob-value');
        probValue.textContent = slider.value;
    });
    updateTotalProbability();
    
    if (isRemixing && remixSequence.length > 0) {
        updateRemixSequence();
    }
    
    updateActivePreset('dub');
});

// Slow button event listener (100% 1/2)
document.getElementById('slowButton').addEventListener('click', () => {
    const sliders = document.querySelectorAll('.probability-slider input[type="range"]');
    sliders.forEach(slider => {
        if (slider.dataset.note === '1/2') {
            slider.value = 100;
        } else {
            slider.value = 0;
        }
        // Update the displayed value
        const label = slider.parentElement.querySelector('label');
        const probValue = label.querySelector('.prob-value');
        probValue.textContent = slider.value;
    });
    updateTotalProbability();
    
    if (isRemixing && remixSequence.length > 0) {
        updateRemixSequence();
    }
    
    updateActivePreset('slow');
});

// File upload event listeners
uploadBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileUpload(file);
    }
});

// Initialize
resizeCanvas();
updateTotalProbability();
updateActivePreset('chop'); // Set default active preset
updateDurationValues();

// Clean up when page is unloaded
window.addEventListener('beforeunload', () => {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    if (currentSource) {
        currentSource.stop();
    }
    if (remixInterval) {
        clearInterval(remixInterval);
    }
    if (playheadAnimationId) {
        cancelAnimationFrame(playheadAnimationId);
    }
    // Clear all scheduled timeouts
    clearAllScheduledTimeouts();
});
