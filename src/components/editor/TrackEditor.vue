<script setup lang="ts">
import { useStudioStore } from '../../stores/studio';
import { computed, ref, watch } from 'vue';
import { 
  Play, Pause, Rewind, 
  Volume2, Settings, 
  Activity
} from 'lucide-vue-next';


const store = useStudioStore();
const activeBlock = computed(() => store.activeBlock);

// Active Tab State
const activeTab = ref<'source' | 'timeline'>('timeline');

// Playback State
const isPlaying = ref(false);
const currentTime = ref(0);
const audioRef = ref<HTMLAudioElement | null>(null);

// -- TIMELINE STATE --
const PX_PER_SEC = ref(50);

const draggingBlockId = ref<string | null>(null);

// Computed total time for timeline view
const timelineDuration = computed(() => Math.max(store.totalDuration + 5, 20)); // Min 20s buffer

// AUDIO MANAGEMENT
// We need to manage multiple audio sources or swap them dynamically
// For simple MVP: Source mode plays activeBlock. Timeline mode plays "Composite" (simulated).

// 1. Source Mode Player logic
const toggleSourcePlay = () => {
    if (!audioRef.value || !activeBlock.value?.audioUrl) return;
    if (isPlaying.value) {
        audioRef.value.pause();
        isPlaying.value = false;
    } else {
        audioRef.value.playbackRate = activeBlock.value.speed;
        // If finished, restart from start time
        if (currentTime.value >= activeBlock.value.endTime || currentTime.value < activeBlock.value.startTime) {
             audioRef.value.currentTime = activeBlock.value.startTime;
        }
        audioRef.value.play();
        isPlaying.value = true;
    }
};

const onSourceTimeUpdate = () => {
    if(audioRef.value && activeTab.value === 'source') {
        currentTime.value = audioRef.value.currentTime;
        if(activeBlock.value && currentTime.value >= activeBlock.value.endTime) {
            audioRef.value.pause();
            isPlaying.value = false;
            currentTime.value = activeBlock.value.startTime;
        }
    }
}

// 2. Timeline Mode Player Logic
// A simple sequencer that checks time and triggers one-shot audio
// Ideally we use WebAudio API for accurate timing, but for MVP <audio> is safest.
// Limitation: Overlapping audio is hard with single <audio>. We need multiple.
// Solution: Simple "Play All" using timeouts or just visual preview for now?
// User asked for "Edit", so seeing it is step 1.
// Let's implement a visual playhead for now.

const toggleTimelinePlay = () => {
    if (isPlaying.value) {
        // Stop
        isPlaying.value = false;
        // Stop all audio
        stopAllAudio();
    } else {
        // Start
        isPlaying.value = true;
        playTimeline();
    }
};

let timelineFrameId = 0;
let lastTimestamp = 0;

const playTimeline = () => {
    lastTimestamp = performance.now();
    const tick = (now: number) => {
        if (!isPlaying.value) return;
        const delta = (now - lastTimestamp) / 1000;
        lastTimestamp = now;
        
        currentTime.value += delta;
        
        // Check blocks to play (Simple discrete check)
        store.blocks.forEach(b => {
             if (b.status !== 'done' || !b.audioUrl) return;
             
             // Time relative to block start
             // const blockLocalTime = (currentTime.value - b.timelineStart) * b.speed + b.startTime;
             
             // Check if inside playable range
             if (currentTime.value >= b.timelineStart && 
                 currentTime.value < (b.timelineStart + (b.endTime - b.startTime)/b.speed)) {
                 
                 // If not playing, start? 
                 // This requires a pool of Audio objects. Complex for one file.
                 // Falling back to: Just moving playhead for now unless we implement AudioContext.
             }
        });
        
        if (currentTime.value > timelineDuration.value) {
             isPlaying.value = false;
             currentTime.value = 0;
        } else {
             timelineFrameId = requestAnimationFrame(tick);
        }
    };
    timelineFrameId = requestAnimationFrame(tick);
};

const stopAllAudio = () => {
    cancelAnimationFrame(timelineFrameId);
    if(audioRef.value) {
        audioRef.value.pause();
        audioRef.value.currentTime = 0;
    }
}


// TIMELINE INTERACTION
const onBlockMouseDown = (e: MouseEvent, blockId: string) => {
    if (activeTab.value !== 'timeline') return;
    draggingBlockId.value = blockId;
    
    const startX = e.clientX;
    const block = store.blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const initialStart = block.timelineStart;
    
    store.toggleSelection(blockId, false);

    const onMove = (mv: MouseEvent) => {
        const diffPx = mv.clientX - startX;
        const diffSec = diffPx / PX_PER_SEC.value;
        block.timelineStart = Math.max(0, initialStart + diffSec);
    };
    
    const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        draggingBlockId.value = null;
    };
    
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
};


// UTILS
const getSourcePlayheadPos = () => {
    if (!activeBlock.value || activeBlock.value.duration === 0) return 0;
    return (currentTime.value / activeBlock.value.duration) * 100;
}

watch(activeTab, (val) => {
    isPlaying.value = false;
    currentTime.value = 0;
    if (val === 'source' && activeBlock.value) {
        currentTime.value = activeBlock.value.startTime;
    }
});

// Watch block selection to switch tabs?
watch(() => activeBlock.value, (newVal) => {
    if (newVal && activeTab.value === 'timeline') {
        // Maybe auto-scroll to block?
    }
});

</script>

<template>
  <div class="track-editor">
    <!-- Header / TABS -->
    <div class="panel-header">
      <div 
        class="tab" 
        :class="{ active: activeTab === 'timeline' }"
        @click="activeTab = 'timeline'"
      >
        Timeline
      </div>
      <div 
        class="tab" 
        :class="{ active: activeTab === 'source' }"
        @click="activeTab = 'source'"
      >
        Clip Editor
      </div>
      
      <div class="spacer"></div>
      <button class="icon-btn"><Settings :size="16"/></button>
    </div>

    <!-- MAIN BODY -->
    <div class="editor-body">
    
       <!-- VISUAL MONITOR (Always visible, but changes context) -->
       <div class="monitor-section">
          <div class="video-screen">
             <!-- Visualizer -->
             <div class="visualizer" :class="{ 'is-playing': isPlaying }">
                 <div class="freq-bars">
                    <div v-for="n in 32" :key="n" class="bar" :style="{ '--delay': n * 0.05 + 's' }"></div>
                 </div>
                 
                 <!-- Overlay Text -->
                 <div class="text-overlay" v-if="activeTab === 'source' && activeBlock">
                    <p>"{{ activeBlock.text }}"</p>
                 </div>
                 <div class="text-overlay" v-else-if="activeTab === 'timeline'">
                    <p class="mode-label">SEQUENCE MODE</p>
                 </div>
             </div>
             
             <!-- Timecode -->
             <div class="monitor-status">
                <span class="time-code">{{ currentTime.toFixed(2) }}s</span>
                <span class="total-time" v-if="activeTab==='source' && activeBlock">/ {{ activeBlock.duration.toFixed(2) }}s</span>
                <span class="total-time" v-if="activeTab==='timeline'">/ {{ timelineDuration.toFixed(2) }}s</span>
             </div>
          </div>
          
          <!-- Shared Audio Element (Used for Source playback) -->
          <audio 
              v-if="activeBlock && activeTab === 'source'"
              ref="audioRef" 
              :src="activeBlock.audioUrl" 
              @timeupdate="onSourceTimeUpdate"
              @ended="isPlaying = false"
           ></audio>
       </div>


       <!-- ================= TIMELINE MODE ================= -->
       <div v-if="activeTab === 'timeline'" class="timeline-view">
           <div class="timeline-controls">
               <div class="tc-left">
                   <button class="t-btn main" @click="toggleTimelinePlay">
                       <Pause v-if="isPlaying" :size="16" />
                       <Play v-else :size="16" />
                   </button>
                   <span class="sep"></span>
                   <button class="t-btn" @click="currentTime = 0"><Rewind :size="14" /></button>
               </div>
               <div class="zoom-controls">
                   <button class="t-btn" @click="PX_PER_SEC = Math.max(10, PX_PER_SEC - 10)">-</button>
                   <span>Zoom</span>
                   <button class="t-btn" @click="PX_PER_SEC += 10">+</button>
               </div>
           </div>
           
           <div class="tracks-container" ref="timelineContainer">
                <!-- Ruler -->
                <div class="ruler-x" :style="{ width: (timelineDuration * PX_PER_SEC) + 'px' }">
                    <div v-for="i in Math.floor(timelineDuration)" :key="i" class="tick" :style="{ left: (i * PX_PER_SEC) + 'px' }">
                        <span class="num" v-if="i % 5 === 0">{{ i }}s</span>
                    </div>
                </div>

                <!-- Cursor/Playhead -->
                <div class="global-playhead" :style="{ left: (currentTime * PX_PER_SEC) + 'px' }"></div>

                <!-- Tracks (Vertical Stack) -->
                <!-- Ideally separate tracks if layer logic existed. For now, one 'Sequence' track or separate rows? 
                     User said "Combine", so showing them on one timeline is key.
                     Let's verify vertical space. If we have 20 clips, stacking them vertically is tall.
                     Usually NLEs have 'Tracks' (V1, V2, A1, A2). We can put them all on 'A1' if they don't overlap, 
                     or dynamically stack overlapping ones.
                     Simple approach: Stack by index (diagonal style) or just one row if possible. 
                     Let's do 'One Row per Clip' for clarity, essentially a Gantt chart.
                -->
                <div class="track-lanes">
                     <div 
                        v-for="block in store.blocks" 
                        :key="block.id"
                        class="track-row"
                        :class="{ selected: block.selected }"
                     >
                        <div class="track-header">
                            <span>{{ block.voice || 'No Voice' }}</span>
                        </div>
                        <div class="track-content">
                            <!-- Helper lines -->
                            <div class="grid-bg" :style="{ width: (timelineDuration * PX_PER_SEC) + 'px' }"></div>
                            
                            <!-- The Clip -->
                            <div 
                                v-if="block.audioUrl"
                                class="clip-box"
                                :class="{ selected: block.selected }"
                                :style="{
                                    left: (block.timelineStart * PX_PER_SEC) + 'px',
                                    width: (((block.endTime - block.startTime) / block.speed) * PX_PER_SEC) + 'px'
                                }"
                                @mousedown.stop="(e) => onBlockMouseDown(e, block.id)"
                            >
                                <div class="clip-label">{{ block.text.substring(0, 15) }}...</div>
                                <div class="clip-handle left"></div>
                                <div class="clip-handle right"></div>
                            </div>
                        </div>
                     </div>
                </div>
           </div>
       </div>


       <!-- ================= SOURCE CLIP MODE ================= -->
       <div v-else-if="activeTab === 'source' && activeBlock" class="source-view">
            <!-- Timeline Section -->
           <div class="timeline-section">
              <div class="timeline-tools">
                 <span class="label">Clip Trim</span>
                 <div class="tools-right">
                    <span class="vol-icon"><Volume2 :size="14"/></span>
                 </div>
              </div>
              <div class="track-wrapper">
                 <div class="ruler">
                    <span style="left: 0%">0s</span>
                    <span style="left: 50%">{{ (activeBlock.duration / 2).toFixed(1) }}s</span>
                    <span style="left: 100%">{{ activeBlock.duration.toFixed(1) }}s</span>
                 </div>
                 
                 <div class="track-lane">
                    <div class="waveform-bg"></div>
                    
                    <div class="dim-region left" :style="{ width: (activeBlock.startTime / activeBlock.duration * 100) + '%' }"></div>
                    <div class="dim-region right" :style="{ left: (activeBlock.endTime / activeBlock.duration * 100) + '%', right: 0 }"></div>

                    <div class="active-region" :style="{ 
                       left: (activeBlock.startTime / activeBlock.duration * 100) + '%', 
                       width: ((activeBlock.endTime - activeBlock.startTime) / activeBlock.duration * 100) + '%' 
                    }">
                       <div class="handle start"></div>
                       <div class="handle end"></div>
                    </div>

                    <div class="playhead" :style="{ left: getSourcePlayheadPos() + '%' }">
                       <div class="playhead-line"></div>
                       <div class="playhead-knob"></div>
                    </div>
                 </div>
              </div>
              
              <div class="trim-controls">
                 <div class="t-grp">
                    <label>Start</label>
                    <input type="number" v-model.number="activeBlock.startTime" step="0.1" :max="activeBlock.endTime" />
                 </div>
                 <div class="t-grp">
                    <label>End</label>
                    <input type="number" v-model.number="activeBlock.endTime" step="0.1" :min="activeBlock.startTime" :max="activeBlock.duration" />
                 </div>
              </div>
           </div>

           <!-- Transport & Prop Controls -->
           <div class="interactive-controls">
              <div class="param-row">
                 <div class="param-label">
                    <Activity :size="16" class="icon" />
                    <span>Speed</span>
                 </div>
                 <div class="param-slider">
                    <input type="range" v-model.number="activeBlock.speed" min="0.5" max="2.0" step="0.1" />
                    <span class="val-badge">{{ activeBlock.speed }}x</span>
                 </div>
              </div>
              
              <div class="transport-bar">
                  <button class="transport-btn main" @click="toggleSourcePlay">
                     <Pause v-if="isPlaying" :size="24" fill="currentColor" />
                     <Play v-else :size="24" fill="currentColor" />
                  </button>
              </div>
           </div>
       </div>
       
       <!-- Empty State -->
       <div v-else class="empty-screen">
          <p>Select a clip to edit source properties</p>
       </div>

    </div>
  </div>
</template>

<style scoped>
.track-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--col-bg-surface);
  border-left: 1px solid var(--col-border);
  box-shadow: -10px 0 30px rgba(0,0,0,0.3);
  overflow: hidden;
}

.panel-header {
  height: 40px;
  border-bottom: 1px solid var(--col-border);
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  background: rgba(0,0,0,0.2);
}

.tab {
  padding: 0 1rem;
  height: 100%;
  display: flex;
  align-items: center;
  font-size: 0.9rem;
  color: var(--col-text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.tab:hover { color: var(--col-text-main); }
.tab.active {
  color: var(--col-primary);
  border-bottom-color: var(--col-primary);
  background: rgba(var(--hue-primary), 0.05);
}

.spacer { flex: 1; }
.icon-btn {
  background: transparent;
  border: none;
  color: var(--col-text-muted);
  cursor: pointer;
  padding: 4px;
}

.editor-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

/* MONITOR */
.monitor-section {
  aspect-ratio: 16/9;
  background: black;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  border-bottom: 1px solid var(--col-border);
  flex-shrink: 0;
  max-height: 250px;
}
.video-screen { width: 100%; height: 100%; position: relative; overflow: hidden; }
.visualizer {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  display: flex; align-items: center; justify-content: center;
  flex-direction: column;
  background: radial-gradient(circle at center, rgba(30,30,40, 1), #000);
}
.freq-bars {
  display: flex; gap: 3px; align-items: flex-end; height: 40px; margin-bottom: 1rem;
}
.bar {
  width: 4px; background: var(--col-primary); height: 5px; border-radius: 2px;
  opacity: 0.3;
}
.is-playing .bar {
  animation: bounce 0.5s infinite ease-in-out;
  animation-delay: var(--delay);
  opacity: 1;
}
@keyframes bounce {
  0%, 100% { height: 5px; opacity: 0.5; }
  50% { height: 30px; opacity: 1; }
}
.text-overlay p {
  color: white; background: rgba(0,0,0,0.6); padding: 0.5rem 1rem; border-radius: 4px;
  max-width: 80%; text-align: center; font-size: 0.9rem;
}
.mode-label {
    letter-spacing: 2px; font-weight: bold; color: var(--col-primary);
}
.monitor-status {
  position: absolute; bottom: 10px; right: 15px; font-family: monospace;
  font-size: 0.8rem; color: white; text-shadow: 0 1px 2px black;
}
.time-code { color: var(--col-primary); font-weight: bold; }

/* TIMELINE VIEW STYLES */
.timeline-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 200px;
    background: #111;
}
.timeline-controls {
    height: 36px;
    border-bottom: 1px solid var(--col-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.5rem;
    background: #1a1a1a;
}
.tc-left, .zoom-controls { display: flex; align-items: center; gap: 0.5rem; }
.t-btn {
    background: #333; border: none; color: #ccc; 
    width: 24px; height: 24px; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
}
.t-btn:hover { background: #444; color: white; }
.t-btn.main { background: var(--col-primary); color: white; }
.zoom-controls span { font-size: 0.7rem; color: #888; text-transform: uppercase; }

.tracks-container {
    flex: 1;
    position: relative;
    overflow: auto;
    padding-top: 24px; /* Ruler space */
}
.ruler-x {
    position: absolute; top: 0; left: 0; height: 24px;
    background: #222; border-bottom: 1px solid #333;
    pointer-events: none;
    z-index: 10;
}
.tick {
    position: absolute; top: 0; bottom: 0; width: 1px; background: #333;
}
.tick .num {
    position: absolute; top: 4px; left: 4px; font-size: 0.6rem; color: #666;
}

.global-playhead {
    position: absolute; top: 0; bottom: 0; width: 1px;
    background: red; z-index: 100; pointer-events: none;
}
.global-playhead::after {
    content: ''; position: absolute; top: 0; left: -5px;
    border-top: 5px solid red; border-left: 5px solid transparent; border-right: 5px solid transparent;
}

.track-lanes {
    display: flex; flex-direction: column;
}
.track-row {
    display: flex; height: 40px; border-bottom: 1px solid #222;
}
.track-header {
    width: 80px; flex-shrink: 0; background: #1a1a1a; border-right: 1px solid #333;
    display: flex; align-items: center; padding-left: 8px;
    font-size: 0.7rem; color: #aaa; overflow: hidden; white-space: nowrap;
}
.track-content {
    flex: 1; position: relative;
}
.grid-bg { 
    height: 100%; 
    background-image: linear-gradient(90deg, #222 1px, transparent 1px);
    background-size: 50px 100%; /* 1 sec lines? Depends on Zoom */
}

/* CLIP BOX IN TIMELINE */
.clip-box {
    position: absolute; top: 4px; bottom: 4px;
    background: rgba(var(--hue-primary), 0.4);
    border: 1px solid var(--col-primary);
    border-radius: 4px;
    cursor: grab;
    display: flex; align-items: center; overflow: hidden;
    padding: 0 4px;
}
.clip-box:hover { background: rgba(var(--hue-primary), 0.6); }
.clip-box.selected { background: var(--col-primary); color: white; box-shadow: 0 0 0 1px white; }
.clip-label {
    font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
    pointer-events: none; color: white;
}
.clip-handle {
    position: absolute; top: 0; bottom: 0; width: 6px; cursor: col-resize;
    background: rgba(0,0,0,0.2);
}
.clip-handle.left { left: 0; }
.clip-handle.right { right: 0; }


/* SOURCE VIEW (Reused from previous) */
.source-view { padding: 1rem; }
.timeline-section {
  padding: 1rem;
  border-bottom: 1px solid var(--col-border);
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.timeline-tools {
  display: flex; justify-content: space-between; margin-bottom: 0.5rem;
  font-size: 0.8rem; color: var(--col-text-muted); text-transform: uppercase;
}
.track-wrapper { position: relative; height: 60px; margin: 0.5rem 0 1rem 0; user-select: none; }
.ruler { height: 20px; position: relative; font-size: 0.7rem; color: var(--col-text-muted); border-bottom: 1px solid var(--col-border); margin-bottom: 5px; }
.ruler span { position: absolute; transform: translateX(-50%); }
.track-lane {
  height: 40px; background: rgba(0,0,0,0.3); border-radius: 4px; position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);
}
.active-region {
  position: absolute; top: 0; bottom: 0; background: rgba(var(--hue-primary), 0.2);
  border-top: 2px solid var(--col-primary); border-bottom: 2px solid var(--col-primary);
}
.dim-region { position: absolute; top: 0; bottom: 0; background: rgba(0,0,0,0.6); pointer-events: none; }
.playhead {
  position: absolute; top: 0; bottom: 0; width: 1px; background: #fff; z-index: 10;
}
.trim-controls { display: flex; gap: 1rem; }
.t-grp { display: flex; gap: 0.5rem; align-items: center; font-size: 0.8rem; color: var(--col-text-muted); }
.t-grp input {
  background: transparent; border: 1px solid var(--col-border); color: var(--col-text-main);
  width: 50px; padding: 2px; border-radius: 4px; text-align: right;
}

.interactive-controls { padding: 1rem 0; }
.param-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.param-label { display: flex; align-items: center; gap: 0.5rem; width: 70px; color: var(--col-text-muted); font-size: 0.8rem; }
.param-slider { flex: 1; display: flex; align-items: center; gap: 1rem; }
.param-slider input { flex: 1; }
.val-badge { background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; min-width: 40px; text-align: center; }
.transport-bar { display: flex; justify-content: center; gap: 1rem; }
.transport-btn.main {
  width: 48px; height: 48px; background: var(--col-primary); border: none; color: white;
  border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;
  box-shadow: 0 4px 15px rgba(var(--hue-primary), 0.4);
}

.empty-screen {
  flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center;
  color: var(--col-text-muted); text-align: center; padding: 2rem;
}
</style>
