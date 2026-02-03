
// Basic WAV File Encoder setup
function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i] ?? 0));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* RIFF chunk length */
    view.setUint32(4, 36 + samples.length * 2, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, 1, true);
    /* channel count */
    view.setUint16(22, 1, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * 2, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 2, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples.length * 2, true);

    floatTo16BitPCM(view, 44, samples);

    return new Blob([view], { type: 'audio/wav' });
}


export async function exportAudioProject(blocks: any[], duration: number) {
    if (blocks.length === 0 || duration <= 0) return;

    // 1. Setup OfflineContext
    // Standard sample rate 44.1kHz or 48kHz
    const sampleRate = 44100;
    const length = Math.ceil(duration * sampleRate);

    // Fallback if browser doesn't support OfflineAudioContext
    const OfflineContext = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!OfflineContext) {
        throw new Error("Web Audio API not supported");
    }

    const ctx = new OfflineContext(1, length, sampleRate);

    // 2. Load and Schedule
    const loadPromises = blocks
        .filter(b => b.audioUrl && b.status === 'done')
        .map(async (block) => {
            try {
                const response = await fetch(block.audioUrl);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;

                // Playback Rate
                source.playbackRate.value = block.speed || 1;

                // Timing calculations
                const startWhen = block.timelineStart || 0;
                const offset = block.startTime || 0;

                // Duration to play from source (unscaled time)
                let durationToPlay = (block.endTime || audioBuffer.duration) - offset;

                // Sanity check
                if (durationToPlay <= 0) return;

                source.connect(ctx.destination);
                source.start(startWhen, offset, durationToPlay);
            } catch (e) {
                console.error("Failed to process block", block, e);
            }
        });

    await Promise.all(loadPromises);

    // 3. Render
    const renderedBuffer = await ctx.startRendering();

    // 4. Encode to WAV
    // We only did mono (1 channel) for simplicity
    const pcmData = renderedBuffer.getChannelData(0);
    const wavBlob = encodeWAV(pcmData, sampleRate);

    // 5. Download
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `voice_project_${new Date().toISOString().slice(0, 10)}.wav`;
    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}
