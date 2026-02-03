<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useStudioStore } from '../../stores/studio';
import { Play, Pause, Trash2 } from 'lucide-vue-next';

const props = defineProps<{
  blockId: string;
  voices: string[];
}>();

const store = useStudioStore();
const block = computed(() => store.blocks.find(b => b.id === props.blockId));
// Get global playback state to show active status
const isPlaying = computed(() => 
    store.isPlaying && 
    store.currentTime >= (block.value?.timelineStart || 0) && 
    store.currentTime < ((block.value?.timelineStart || 0) + (block.value?.duration || 0))
);

const togglePlay = () => {
  if (!block.value?.audioUrl) return;
  
  if (isPlaying.value) {
      store.isPlaying = false;
  } else {
      // Jump to this block on timeline and play
      store.seek(block.value.timelineStart);
      store.isPlaying = true;
  }
};

// Remove local audio watchers/refs since we use global engine
// Watch for speed changes is handled by global engine check

</script>

<template>
  <div 
    v-if="block"
    class="script-block glass-panel"
    :class="{ 'selected': block.selected, 'playing': isPlaying }"
    @click="store.toggleSelection(block.id, false)"
  >
    <div class="block-header">
      <input 
        type="checkbox" 
        :checked="block.selected" 
        @click.stop="store.toggleSelection(block.id, true)"
        class="checkbox"
      />
      <select 
        v-model="block.voice" 
        class="voice-select"
        @click.stop
      >
        <option value="" disabled>Select Voice</option>
        <option v-for="v in voices" :key="v" :value="v">{{ v }}</option>
      </select>
      <div class="spacer"></div>
      <button class="delete-btn" @click.stop="store.removeBlock(block.id)">
        <Trash2 :size="16" />
      </button>
    </div>
    
    <div class="block-content">
      <textarea 
        v-model="block.text" 
        class="script-input" 
        placeholder="Type here..."
        rows="3"
        @click.stop="store.toggleSelection(block.id, false)"
      ></textarea>
      
      <div class="playback-controls" v-if="block.audioUrl">
        <button class="play-btn" @click.stop="togglePlay">
          <Pause v-if="isPlaying" :size="16" />
          <Play v-else :size="16" />
        </button>
        <div class="waveform-viz" v-if="block.duration > 0">
           <!-- Simple viz showing active range -->
           <div 
             class="active-range"
             :style="{
               left: (block.startTime / block.duration * 100) + '%',
               width: ((block.endTime - block.startTime) / block.duration * 100) + '%'
             }"
           ></div>
           
           <!-- Current Playhead (if playing this block) -->
           <div v-if="isPlaying" class="playhead-indicator" :style="{
               left: (( ((store.currentTime - block.timelineStart)*block.speed + block.startTime) / block.duration ) * 100) + '%'
           }"></div>
        </div>
        <div class="time-display" v-if="block.duration > 0">
           {{ block.startTime.toFixed(1) }}s - {{ block.endTime.toFixed(1) }}s
        </div>
      </div>
      
      <div v-if="block.status === 'loading'" class="loading-overlay">
         <div class="spinner"></div>
      </div>
      <div v-if="block.status === 'error'" class="error-badge">
         Error
      </div>
    </div>
    
    <!-- Audio moved to Global Engine -->

  </div>
</template>

<style scoped>
.script-block {
  padding: 1rem;
  margin-bottom: 1rem;
  border: 1px solid transparent;
  transition: all 0.2s;
  position: relative;
  background: rgba(30, 32, 45, 0.4); 
}

.script-block.selected {
  border-color: var(--col-primary);
  background: rgba(var(--hue-primary), 0.1);
  box-shadow: 0 0 15px rgba(var(--hue-primary), 0.15);
}

.block-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.8rem;
}

.spacer { flex: 1; }

.checkbox {
  accent-color: var(--col-primary);
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.voice-select {
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--col-border);
  color: var(--col-text-main);
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  cursor: pointer;
}
.voice-select:focus { border-color: var(--col-primary); outline: none; }

.script-input {
  width: 100%;
  background: rgba(0,0,0,0.1);
  border: none;
  border-radius: var(--radius-sm);
  padding: 0.8rem;
  color: var(--col-text-main);
  resize: vertical;
  min-height: 80px;
  font-family: var(--font-main);
  font-size: 1rem;
  box-sizing: border-box;
}
.script-input:focus {
  outline: none;
  background: rgba(0,0,0,0.2);
}

.playback-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.8rem;
  padding-top: 0.8rem;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.play-btn {
  background: var(--col-primary);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  transition: transform 0.2s;
}
.play-btn:hover { transform: scale(1.1); }

.waveform-viz {
  flex: 1;
  height: 6px;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}

.active-range {
  position: absolute;
  top: 0; bottom: 0;
  background: var(--col-primary);
  border-radius: 3px;
  opacity: 0.8;
}

.time-display {
  font-size: 0.8rem;
  color: var(--col-text-muted);
  font-family: monospace;
}

.loading-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: var(--radius-md);
  backdrop-filter: blur(2px);
}

.delete-btn {
  background: transparent;
  border: none;
  color: var(--col-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}
.delete-btn:hover { 
  color: #ff6060; 
  background: rgba(255, 60, 60, 0.1);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #fff;
  border-bottom-color: transparent;
  border-radius: 50%;
  animation: rotation 1s linear infinite;
}

@keyframes rotation {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-badge {
    position: absolute;
    top: 10px; right: 10px;
    background: #ff4040;
    color: white;
    border-radius: 4px;
}

.playhead-indicator {
    position: absolute;
    top: 0; bottom: 0;
    width: 2px;
    background: white;
    z-index: 5;
    box-shadow: 0 0 4px rgba(0,0,0,0.5);
    pointer-events: none;
}
</style>
