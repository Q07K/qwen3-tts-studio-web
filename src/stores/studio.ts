import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { generateVoice, generateBatchVoice } from '../api/voices';

export interface ScriptBlockData {
    id: string;
    text: string;
    voice: string;
    audioUrl?: string;
    status: 'idle' | 'loading' | 'done' | 'error';
    speed: number;
    // Source Trim (Time within the clip)
    startTime: number;
    endTime: number;
    duration: number; // Original duration
    // Global Timeline (Time on the global sequencer)
    timelineStart: number;
    trackId: number; // For vertical layering
    selected: boolean;
}

// Fallback UUID generator for non-secure contexts
function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for HTTP contexts
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export const useStudioStore = defineStore('studio', () => {
    const blocks = ref<ScriptBlockData[]>([]);
    const batchLimit = ref(5);
    const globalVoice = ref(''); // Default voice for new blocks
    const userDuration = ref(0); // User override for project length

    // Global Playback State

    // Global Playback State
    const currentTime = ref(0);
    const isPlaying = ref(false);

    function seek(time: number) {
        currentTime.value = time;
    }


    const selectedBlocks = computed(() => blocks.value.filter(b => b.selected));
    const activeBlock = computed(() => selectedBlocks.value.length === 1 ? selectedBlocks.value[0] : null);

    // Dynamic duration of the entire sequence
    const totalDuration = computed(() => {
        if (blocks.value.length === 0) return 0;
        let max = 0;
        blocks.value.forEach(b => {
            const clipDuration = (b.endTime - b.startTime) / b.speed;
            const end = b.timelineStart + clipDuration;
            if (end > max) max = end;
        });
        return max;
    });

    // The actual duration of the project (content or user override)
    const projectDuration = computed(() => {
        return Math.max(totalDuration.value, userDuration.value);
    });

    function addBlock(index?: number) {
        // Auto-position at the end of the last block
        let start = 0;
        if (blocks.value.length > 0) {
            const last = blocks.value[blocks.value.length - 1]!;
            // Estimate duration if not generated yet, otherwise use real
            const lastDur = last.duration > 0 ? (last.endTime - last.startTime) / last.speed : 0;
            start = last.timelineStart + lastDur;
        }

        const newBlock: ScriptBlockData = {
            id: generateUUID(),
            text: '',
            voice: globalVoice.value || '',
            status: 'idle',
            speed: 1.0,
            startTime: 0,
            endTime: 0,
            duration: 0,
            timelineStart: start,
            trackId: 0,
            selected: false
        };
        if (typeof index === 'number') {
            blocks.value.splice(index, 0, newBlock);
        } else {
            blocks.value.push(newBlock);
        }
    }

    function removeBlock(id: string) {
        const idx = blocks.value.findIndex(b => b.id === id);
        if (idx !== -1) blocks.value.splice(idx, 1);
    }

    function toggleSelection(id: string, multi: boolean) {
        if (!multi) {
            // Clear others
            blocks.value.forEach(b => {
                if (b.id !== id) b.selected = false;
            });
        }
        const block = blocks.value.find(b => b.id === id);
        if (block) {
            if (!multi) block.selected = true;
            else block.selected = !block.selected;
        }
    }

    async function fetchAudioDuration(url: string): Promise<number> {
        return new Promise((resolve, reject) => {
            const audio = new Audio(url);
            audio.preload = 'metadata';
            audio.onloadedmetadata = () => {
                resolve(audio.duration);
            };
            audio.onerror = (e) => reject(e);
            setTimeout(() => resolve(0), 5000);
        });
    }

    function autoReflow(_affectedBlocks: ScriptBlockData[]) {
        const all = blocks.value;
        for (let i = 1; i < all.length; i++) {
            const prev = all[i - 1];
            const curr = all[i];

            if (!prev || !curr) continue;

            const prevEnd = prev.timelineStart + ((prev.endTime - prev.startTime) / prev.speed);

            // If current block starts before the previous one ends (with a small buffer/tolerance),
            // shift it to the end of the previous block.
            // This fixes the issue where generated blocks pile up at 0 or the previous insertion point.
            if (curr.timelineStart < prevEnd - 0.05) {
                curr.timelineStart = prevEnd;
            }
        }
    }

    async function generateBlock(id: string) {
        const block = blocks.value.find(b => b.id === id);
        if (!block || !block.text || !block.voice) return;

        block.status = 'loading';
        try {
            const res = await generateVoice({
                text: block.text,
                voice_name: block.voice,
                language: 'korean'
            });
            const blob = res.data; // Axios response data
            const url = URL.createObjectURL(blob);

            const duration = await fetchAudioDuration(url);

            block.audioUrl = url;
            block.status = 'done';
            block.duration = duration;
            block.endTime = duration;
            block.startTime = 0;

            autoReflow([block]);

        } catch (e) {
            console.error(e);
            block.status = 'error';
        }
    }

    async function generateBatch() {
        let targets = selectedBlocks.value;
        if (targets.length === 0) targets = blocks.value;

        const groups = new Map<string, ScriptBlockData[]>();
        for (const t of targets) {
            if (!t.voice) continue;
            if (!groups.has(t.voice)) groups.set(t.voice, []);
            groups.get(t.voice)!.push(t);
        }

        for (const [voice, group] of groups) {
            for (let i = 0; i < group.length; i += batchLimit.value) {
                const chunk = group.slice(i, i + batchLimit.value);
                chunk.forEach(b => b.status = 'loading');

                try {
                    const res = await generateBatchVoice({
                        texts: chunk.map(b => b.text),
                        voice_name: voice,
                        language: 'auto'
                    });

                    const data = res.data;
                    console.log('Batch response data:', data);

                    let responses: any[] = [];
                    if (data && Array.isArray((data as any).audio_files)) {
                        responses = (data as any).audio_files;
                    }
                    else if (Array.isArray(data)) {
                        responses = data;
                    }
                    else if (typeof data === 'object' && data !== null) {
                        const keys = Object.keys(data).sort((a, b) => parseInt(a) - parseInt(b));
                        const numericKeys = keys.filter(k => !isNaN(parseInt(k)));
                        if (numericKeys.length > 0) {
                            responses = numericKeys.map(k => (data as any)[k]);
                        }
                    }

                    const updatePromises = responses.map(async (item, idx) => {
                        const blockItem = chunk[idx];
                        if (!blockItem) return;

                        let b64 = '';
                        if (typeof item === 'string') {
                            b64 = item;
                        } else if (item && typeof item === 'object' && typeof item.data === 'string') {
                            b64 = item.data;
                        }

                        if (b64) {
                            try {
                                const byteCharacters = atob(b64);
                                const byteNumbers = new Array(byteCharacters.length);
                                for (let j = 0; j < byteCharacters.length; j++) {
                                    byteNumbers[j] = byteCharacters.charCodeAt(j);
                                }
                                const byteArray = new Uint8Array(byteNumbers);
                                const blob = new Blob([byteArray], { type: 'audio/wav' });
                                const url = URL.createObjectURL(blob);

                                const duration = await fetchAudioDuration(url);

                                blockItem.audioUrl = url;
                                blockItem.status = 'done';
                                blockItem.duration = duration;
                                blockItem.endTime = duration;
                                blockItem.startTime = 0;
                            } catch (parseError) {
                                console.error('Error parsing audio data', parseError);
                                blockItem.status = 'error';
                            }
                        } else {
                            blockItem.status = 'error';
                        }
                    });

                    await Promise.all(updatePromises);

                    chunk.forEach(b => {
                        if (b.status === 'loading') {
                            b.status = 'error';
                        }
                    });

                    autoReflow(chunk);

                } catch (e) {
                    console.error(e);
                    chunk.forEach(b => b.status = 'error');
                }
            }
        }
    }

    function sortBlocksByTime() {
        blocks.value.sort((a, b) => {
            return a.timelineStart - b.timelineStart;
        });
    }

    return {
        blocks,
        batchLimit,
        activeBlock,
        selectedBlocks,
        addBlock,
        removeBlock,
        toggleSelection,
        generateBlock,
        generateBatch,
        sortBlocksByTime,
        globalVoice,
        totalDuration,
        currentTime,
        isPlaying,
        seek,
        userDuration,
        projectDuration
    };
});
