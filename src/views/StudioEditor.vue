<script setup lang="ts">
import { onMounted, ref, computed, onUnmounted, watch } from 'vue';
import { useStudioStore } from '../stores/studio';
import { getVoices } from '../api/voices';
import ScriptBlock from '../components/editor/ScriptBlock.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import { 
    Plus, Layers, Play, Pause, 
    Rewind, ZoomIn, ZoomOut,
    SkipForward, Download
} from 'lucide-vue-next';
import { exportAudioProject } from '../utils/audioExport';

const store = useStudioStore();
const voices = ref<string[]>([]);
const loadingVoices = ref(false);
const isExporting = ref(false);

const handleExport = async () => {
    isExporting.value = true;
    try {
        await exportAudioProject(store.blocks, store.projectDuration);
    } catch (e) {
        console.error("Export failed", e);
        // Using alert for simplicity, could be a toast
        alert("Export failed. Please ensure all audio is generated.");
    } finally {
        isExporting.value = false;
    }
};

// Timeline State
const PX_PER_SEC = ref(50);
// Viewport duration should be enough to show the project + some buffer
const timelineDuration = computed(() => Math.max(store.projectDuration + 5, 20));

// Link to Global Store

// Link to Global Store
const isPlaying = computed({
    get: () => store.isPlaying,
    set: (val) => store.isPlaying = val
});
const currentTime = computed({
    get: () => store.currentTime,
    set: (val) => store.seek(val)
});

// Audio Engine State
const audioCache = new Map<string, HTMLAudioElement>(); // Preloaded audios
const activeAudios = new Map<string, HTMLAudioElement>(); // Currently playing
let animationFrameId = 0;
let lastTimestamp = 0;

// Preload Audios when blocks change (Watch deeply)
watch(() => store.blocks, (newBlocks) => {
    // 1. Remove stale audios from cache
    const currentIds = new Set(newBlocks.map(b => b.id));
    for (const [id, audio] of audioCache.entries()) {
        if (!currentIds.has(id)) {
            // If playing, pause first
            if (!audio.paused) audio.pause();
            audioCache.delete(id);
            activeAudios.delete(id);
        }
    }
    
    // 2. Add/Update new audios
    newBlocks.forEach(block => {
        if (!block.audioUrl || block.status !== 'done') return;
        
        // Check cache
        let audio = audioCache.get(block.id);
        if (!audio) {
            audio = new Audio(block.audioUrl);
            audio.preload = 'auto'; // Force preload
            audioCache.set(block.id, audio);
        } else if (audio.src !== block.audioUrl) {
            // URL changed
            audio.src = block.audioUrl;
            audio.load();
        }
    });
}, { deep: true, immediate: true });

onMounted(async () => {
  loadingVoices.value = true;
  try {
    const res = await getVoices();
    voices.value = res.data;
  } catch (e) {
    console.error(e);
  } finally {
    loadingVoices.value = false;
  }
  
  if (store.blocks.length === 0) {
    store.addBlock();
  }
});

onUnmounted(() => {
    stopPlayback();
});

// --- AUDIO ENGINE ---
const stopPlayback = () => {
    store.isPlaying = false;
    cancelAnimationFrame(animationFrameId);
    activeAudios.forEach(audio => {
        audio.pause();
    });
    activeAudios.clear();
};

const togglePlayback = () => {
    store.isPlaying = !store.isPlaying;
};

// Monitor Play State Change
watch(() => store.isPlaying, (playing) => {
    if (playing) {
        lastTimestamp = performance.now();
        tick();
    } else {
        cancelAnimationFrame(animationFrameId);
        activeAudios.forEach(a => a.pause());
        activeAudios.clear();
    }
});

const tick = () => {
    if (!store.isPlaying) return;
    
    const now = performance.now();
    const delta = (now - lastTimestamp) / 1000;
    lastTimestamp = now;
    
    // Increment time (local update then sync store)
    const nextTime = store.currentTime + delta;
    store.seek(nextTime);
    
    // Check for sequence end (add buffer)
    if (nextTime > timelineDuration.value + 1.0) {
        stopPlayback();
        store.seek(0);
        return;
    }

    // Process blocks
    store.blocks.forEach(block => {
        if (!block.audioUrl || block.status !== 'done') return;
        
        // Force number types to avoid any string concatenation weirdness
        const start = Number(block.timelineStart) || 0;
        const speed = Number(block.speed) || 1;
        const trimStart = Number(block.startTime) || 0;
        const trimEnd = Number(block.endTime) || 0;
        
        const clipDuration = (trimEnd - trimStart) / speed;
        const end = start + clipDuration;
        
        // Check using STORE time
        const cTime = store.currentTime;
        const isInside = cTime >= start && cTime < end;
        
        // Use cached audio if available
        let audio = audioCache.get(block.id);
        if (!audio) {
            // Lazy load if missed by watcher
            audio = new Audio(block.audioUrl);
            audio.preload = 'auto';
            audioCache.set(block.id, audio);
        }

        if (isInside) {
            const expectedLocalTime = (cTime - start) * speed + trimStart;
            
            // Should be playing?
            if (!activeAudios.has(block.id)) {
                // START PLAYING
                audio.playbackRate = speed;
                audio.volume = 1.0;
                
                // Safe seek
                if (Number.isFinite(expectedLocalTime)) {
                    audio.currentTime = Math.max(0, expectedLocalTime);
                }
                
                const p = audio.play();
                if (p !== undefined) {
                    p.catch(e => console.warn("Play interrupted", e));
                }
                
                activeAudios.set(block.id, audio);
            } else {
                // ALREADY PLAYING - SYNC
                if (audio.paused && audio.readyState >= 3) {
                     audio.play().catch(() => {});
                }

                // Sync Speed
                if (Math.abs(audio.playbackRate - speed) > 0.01) {
                    audio.playbackRate = speed;
                }
                
                // Only sync time if readyState is enough
                if (audio.readyState >= 2) { 
                    const diff = audio.currentTime - expectedLocalTime;
                    // drift correction: loose if < 0.2s, hard snap if > 0.2s
                    if (Math.abs(diff) > 0.2) {
                        audio.currentTime = expectedLocalTime;
                    }
                }
            }
        } else {
            // Outside of block - STOP
            if (activeAudios.has(block.id)) {
                // If it is playing, pause it
                if (activeAudios.get(block.id) && !activeAudios.get(block.id)?.paused) {
                    activeAudios.get(block.id)?.pause();
                }
                activeAudios.delete(block.id);
            }
        }
    });

    animationFrameId = requestAnimationFrame(tick);
};

const seek = (time: number) => {
    store.seek(Math.max(0, Math.min(time, timelineDuration.value)));
    // If playing, tick will pick it up
};


// --- DRAG & DROP LOGIC ---
const handleBlockMouseDown = (e: MouseEvent, blockId: string) => {
    e.stopPropagation();
    store.toggleSelection(blockId, false);
    
    // Simple Drag Implementation
    const startX = e.clientX;
    const block = store.blocks.find(b => b.id === blockId);
    if(!block) return;
    const initialStart = block.timelineStart;
    
    const onMove = (ev: MouseEvent) => {
        const deltaPx = ev.clientX - startX;
        const deltaSec = deltaPx / PX_PER_SEC.value;
        block.timelineStart = Math.max(0, initialStart + deltaSec);
    };
    
    const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        // Sync script order with visual order
        store.sortBlocksByTime();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
};

// --- DURATION DRAG LOGIC ---
const handleDurationDrag = (e: MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const initialDuration = store.projectDuration;

    const onMove = (ev: MouseEvent) => {
        const deltaPx = ev.clientX - startX;
        const deltaSec = deltaPx / PX_PER_SEC.value;
        // Snap to nearest 0.1s
        const rawNew = Math.max(0, initialDuration + deltaSec);
        store.userDuration = Math.round(rawNew * 10) / 10;
    };

    const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
};

</script>

<template>
  <div class="studio-layout">
    
    <!-- TOP AREA: SCRIPT (LEFT) + MONITOR (RIGHT) -->
    <div class="top-area">
        
        <!-- Script / Source Panel -->
        <div class="panel script-panel glass-panel">
            <div class="panel-header">
                <h3>Script Editor</h3>
                <div class="actions">
                    <BaseButton variant="secondary" @click.stop="store.addBlock()" class="xs-btn">
                      <Plus :size="14" /> Add Block
                    </BaseButton>
                </div>
            </div>
            
            <div class="panel-content script-list-content" @click="store.toggleSelection('', false)">
                 <div v-for="(block, index) in store.blocks" :key="block.id" class="block-wrapper">
                   <ScriptBlock :blockId="block.id" :voices="voices" />
                   <!-- Quick Add Zone -->
                   <div class="add-divider" @click.stop="store.addBlock(index + 1)">
                      <div class="line"></div>
                      <div class="plus-icon"><Plus :size="14"/></div>
                      <div class="line"></div>
                   </div>
                </div>
                
                <div class="empty-pad" @click.stop="store.addBlock()">
                   <p>+ New Block</p>
                </div>
            </div>
            
            <div class="panel-footer">
                <BaseButton variant="primary" @click.stop="store.generateBatch">
                  <Layers :size="16" /> {{ store.selectedBlocks.length > 0 ? `Generate Selected` : 'Generate All' }}
                </BaseButton>
            </div>
        </div>

        <!-- Monitor / Preview Panel -->
        <div class="panel monitor-panel glass-panel">
            <div class="panel-header">
                <h3>Monitor</h3>
                <div class="monitor-header-right" style="display:flex; align-items:center; gap: 1rem;">
                    <div class="time-readout">
                        {{ currentTime.toFixed(2) }}s <span class="dim">/ {{ store.projectDuration.toFixed(2) }}s</span>
                    </div>
                    <!-- Reset Duration Button if overridden -->
                    <button v-if="store.userDuration > 0 && store.userDuration > store.totalDuration" 
                            class="icon-btn xs-btn" 
                            @click="store.userDuration = 0"
                            title="Reset to content length"
                            style="font-size:0.7rem; color:var(--col-warning)">
                            Reset End
                    </button>
                    <button class="icon-btn" @click="handleExport" :disabled="isExporting || store.blocks.length === 0" title="Export to WAV">
                        <span v-if="isExporting" style="font-size:0.7rem">Saving...</span>
                        <Download v-else :size="16" />
                    </button>
                </div>
            </div>
            <div class="monitor-screen">
                <!-- Visualizer Mockup -->
                <div class="viz-container">
                    <div class="grid-overlay"></div>
                    <div class="center-marker"></div>
                    
                    <div class="active-text-overlay">
                        <!-- Show text of currently playing block -->
                        <transition name="fade">
                            <h2 v-if="isPlaying && activeAudios.size > 0">
                                Playing...
                            </h2>
                            <h2 v-else-if="!isPlaying">
                                Ready
                            </h2>
                        </transition>
                    </div>
                </div>
            </div>
            <div class="monitor-controls">
                <button class="transport-btn" @click="seek(0)"><Rewind :size="18"/></button>
                <button class="transport-btn main" @click="togglePlayback">
                    <Pause v-if="isPlaying" :size="24" fill="currentColor"/>
                    <Play v-else :size="24" fill="currentColor"/>
                </button>
                <button class="transport-btn" @click="seek(timelineDuration)"><SkipForward :size="18"/></button>
            </div>
        </div>
        
    </div>

    <!-- BOTTOM AREA: TIMELINE -->
    <div class="bottom-area glass-panel">
        <div class="timeline-header">
            <div class="tools-left">
                <span class="active">Timeline 1</span>
            </div>
            <div class="tools-right">
                <button class="icon-btn" @click="PX_PER_SEC = Math.max(10, PX_PER_SEC - 10)"><ZoomOut :size="16"/></button>
                <span class="zoom-val">{{ PX_PER_SEC }}%</span>
                <button class="icon-btn" @click="PX_PER_SEC += 10"><ZoomIn :size="16"/></button>
            </div>
        </div>
        
        <div class="timeline-body">
             <!-- Ruler Container (Aligned with Tracks) -->
             <div class="timeline-ruler-row">
                 <div class="ruler-gutter"></div>
                 <div class="ruler-x" :style="{ width: (timelineDuration * PX_PER_SEC) + 'px' }" @click="(e) => seek(e.offsetX / PX_PER_SEC)">
                    <div v-for="i in Math.floor(timelineDuration)" :key="i" class="tick" :style="{ left: (i * PX_PER_SEC) + 'px' }">
                        <span class="num" v-if="i % 5 === 0">{{ i }}s</span>
                    </div>
                    <!-- Playhead -->
                     <div class="playhead" :style="{ left: (currentTime * PX_PER_SEC) + 'px' }">
                        <div class="head"></div>
                        <div class="line"></div>
                    </div>

                    <!-- Project End Marker -->
                    <div class="project-end-marker" 
                         :style="{ left: (store.projectDuration * PX_PER_SEC) + 'px' }"
                         @mousedown="handleDurationDrag"
                         @click.stop
                         title="Drag to adjust project duration"
                    >
                        <div class="end-flag">END</div>
                        <div class="end-line"></div>
                    </div>

                 </div>
             </div>

             <!-- Tracks -->
             <div class="tracks-viewport">
                 <div class="track-row">
                      <div class="track-label">Voice</div>
                      <div class="track-lane" :style="{ width: (timelineDuration * PX_PER_SEC) + 'px' }">
                           <!-- Grid Lines -->
                           <div class="grid-bg" :style="{ backgroundSize: `${PX_PER_SEC}px 100%` }"></div>
                           
                           <!-- Clips -->
                           <div 
                                v-for="block in store.blocks" 
                                :key="block.id"
                                class="timeline-clip"
                                :class="{ 
                                    selected: block.selected,
                                    'has-audio': !!block.audioUrl
                                }"
                                :style="{
                                    left: (block.timelineStart * PX_PER_SEC) + 'px',
                                    width: Math.max(2, ((block.endTime - block.startTime) / block.speed) * PX_PER_SEC) + 'px'
                                }"
                                @mousedown="(e) => handleBlockMouseDown(e, block.id)"
                           >
                                <div class="clip-name">{{ block.text.substring(0, 20) || 'New Clip' }}</div>
                                <div class="clip-wave" v-if="block.audioUrl"></div>
                                
                                <!-- Selection Ring -->
                                <div class="sel-ring" v-if="block.selected"></div>
                           </div>
                      </div>
                 </div>
             </div>
        </div>
    </div>
    
  </div>
</template>

<style scoped>
.studio-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 4px;
  overflow: hidden;
}

.top-area {
    flex: 1;
    display: flex;
    gap: 4px;
    min-height: 0; 
}

.panel {
    display: flex;
    flex-direction: column;
}

.script-panel {
    flex: 0 0 40%; /* 40% Width for Script */
    min-width: 350px;
    max-width: 50%;
    border-radius: 0;
}

.monitor-panel {
    flex: 1;
    border-radius: 0;
    border-left: 1px solid var(--col-border);
}

.bottom-area {
    height: 300px; /* Fixed height for timeline (like AE) */
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-radius: 0;
    border-top: 1px solid var(--col-border);
}


/* Common Panel Styles */
.panel-header {
    height: 40px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--col-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    background: rgba(255,255,255,0.02);
}
.panel-header h3 { font-size: 0.9rem; color: var(--col-text-muted); text-transform: uppercase; margin: 0; letter-spacing: 1px; }

.panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
}
.panel-footer {
    padding: 0.8rem;
    border-top: 1px solid var(--col-border);
}

/* Script List Specifics */
.script-list-content { padding: 0.5rem; }
.actions { gap: 0.5rem; display: flex; }
.xs-btn { font-size: 0.75rem; padding: 4px 8px; }

.add-divider {
  display: flex; align-items: center; height: 16px; cursor: pointer; opacity: 0; transition: opacity 0.2s;
}
.add-divider:hover { opacity: 1; }
.line { flex: 1; height: 1px; background: var(--col-primary); }
.plus-icon { background: var(--col-primary); border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; color: white; }

.empty-pad {
  padding: 1rem; text-align: center; color: var(--col-text-muted);
  border: 1px dashed rgba(255,255,255,0.1); border-radius: var(--radius-sm); margin-top: 1rem; cursor: pointer; opacity: 0.5;
}
.empty-pad:hover { opacity: 1; border-color: var(--col-primary); }


/* Monitor Specifics */
.monitor-screen {
    flex: 1;
    background: #000;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}
.monitor-controls {
    height: 50px;
    border-top: 1px solid var(--col-border);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    background: #0a0a0a;
}
.viz-container {
    width: 100%; height: 100%; position: relative;
    background: radial-gradient(circle, #1a1a2e 0%, #000000 70%);
}
.grid-overlay {
    position: absolute; inset: 0;
    background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 50px 50px;
}
.active-text-overlay {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    color: white; text-shadow: 0 4px 20px black; pointer-events: none;
}
.transport-btn {
    background: transparent; color: var(--col-text-muted); border: none; cursor: pointer;
    transition: all 0.2s;
}
.transport-btn:hover { color: white; transform: scale(1.1); }
.transport-btn.main {
    color: var(--col-primary);
    filter: drop-shadow(0 0 8px rgba(124, 92, 255, 0.5));
}


/* Timeline Specifics */
.timeline-header {
    height: 32px;
    background: #111;
    border-bottom: 1px solid var(--col-border);
    display: flex; justify-content: space-between; align-items: center; padding: 0 0.5rem;
}
.tools-left .active { font-size: 0.8rem; color: var(--col-primary); border-bottom: 2px solid var(--col-primary); padding: 0 0.5rem 8px 0.5rem; display: inline-block; }
.tools-right { display: flex; gap: 0.5rem; align-items: center; font-size: 0.75rem; color: #666; }
.icon-btn { background: none; border: none; color: inherit; cursor: pointer; }
.icon-btn:hover { color: white; }

.timeline-body {
    flex: 1;
    background: #080808;
    position: relative;
    overflow-x: auto;
    overflow-y: hidden;
}
.timeline-ruler-row {
    display: flex;
    border-bottom: 1px solid #333;
    background: #080808; 
    /* Ensures it stays atop if we did sticky, but here just layout */
}
.ruler-gutter {
    width: 100px;
    flex-shrink: 0;
    background: #111; /* Match track label bg */
    border-right: 1px solid #333;
}
.ruler-x {
    height: 24px; position: relative; cursor: pointer;
    /* Border bottom handled by row */
}
.tick { position: absolute; top:0; bottom:0; width:1px; background: #333; }
.tick .num { position:absolute; top:4px; left:4px; font-size:0.6rem; color:#666; }

.playhead {
    position: absolute; top: 0; bottom: -300px; width: 1px; z-index: 100; pointer-events: none;
}
.playhead .head {
    position: absolute; top: 0; left: -6px; width: 0; height: 0; 
    border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid var(--col-primary);
}
.playhead .line {
    position: absolute; top: 0; bottom: 0; left: -1px; width: 2px; background: var(--col-primary);
}

.tracks-viewport {
    padding-top: 4px;
}
.track-row {
    display: flex;
    height: 48px;
    border-bottom: 1px solid #222;
}
.track-label {
    width: 100px; flex-shrink: 0; background: #111; border-right: 1px solid #333;
    display: flex; align-items: center; padding-left: 1rem; font-size: 0.8rem; color: #888;
}
.track-lane {
    position: relative;
    flex-grow: 1;
    background: #0a0a0a;
}
.grid-bg { 
    position: absolute; inset:0; 
    background-image: linear-gradient(90deg, #1a1a1a 1px, transparent 1px);
    /* background-size set inline */
}

.timeline-clip {
    position: absolute; top: 4px; bottom: 4px;
    border-radius: 4px;
    cursor: grab;
    background: #2a2a2a; border: 1px solid #444;
    overflow: hidden; padding: 0 6px;
    display: flex; align-items: center;
}
.timeline-clip.has-audio {
    background: rgba(var(--hue-primary), 0.3);
    border-color: var(--col-primary);
}
.timeline-clip.selected {
    border-color: white;
    z-index: 10;
}
.clip-name { font-size: 0.75rem; color: #ccc; white-space: nowrap; }


.project-end-marker {
    position: absolute; top: 0; bottom: -300px; width: 10px; z-index: 90; cursor: ew-resize; transform: translateX(-50%);
}
.project-end-marker:hover .end-line { background: var(--col-warning); }
.project-end-marker:hover .end-flag { background: var(--col-warning); color: #000; }

.end-flag {
    position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    background: #444; color: #aaa; font-size: 0.6rem; padding: 2px 4px; border-radius: 2px;
    white-space: nowrap; font-weight: bold;
}
.end-line {
    position: absolute; top: 16px; bottom: 0; left: 50%; width: 1px; background: #444;
    border-left: 1px dashed #666;
}

</style>
