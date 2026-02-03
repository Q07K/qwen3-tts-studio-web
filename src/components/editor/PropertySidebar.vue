<script setup lang="ts">
import { useStudioStore } from '../../stores/studio';
import { computed } from 'vue';

const store = useStudioStore();
const block = computed(() => store.activeBlock);
</script>

<template>
  <div class="property-sidebar glass-panel">
    <div v-if="block" class="properties">
      <h3>Properties</h3>
      <div class="prop-group">
        <label>Status</label>
        <span class="status-badge" :class="block.status">{{ block.status.toUpperCase() }}</span>
      </div>
      
      <div class="prop-group">
        <label>Playback Speed</label>
        <div class="speed-control">
           <input 
             type="range" 
             min="0.5" 
             max="2.0" 
             step="0.1" 
             v-model.number="block.speed" 
           />
           <span>{{ block.speed }}x</span>
        </div>
      </div>
      
      <div class="prop-group">
        <label>Segment Trim</label>
        <div class="time-inputs">
           <div>
             <span class="sub-label">Start (s)</span>
             <input type="number" v-model.number="block.startTime" step="0.1" min="0" :max="block.endTime" class="sm-input" />
           </div>
           <div>
             <span class="sub-label">End (s)</span>
             <input type="number" v-model.number="block.endTime" step="0.1" :min="block.startTime" :max="block.duration" class="sm-input" />
           </div>
        </div>
        <div class="info-text" v-if="block.duration > 0">
           Original Duration: {{ block.duration.toFixed(2) }}s
        </div>
      </div>
    </div>
    <div v-else class="empty-selection">
       <div class="empty-content">
         <p v-if="store.selectedBlocks.length > 1">Multiple blocks selected.<br/>Edit individually or generate batch.</p>
         <p v-else>Select a block to edit properties.</p>
       </div>
    </div>
  
    <div class="admin-panel">
       <h3>Settings</h3>
       <div class="prop-group">
          <label>Batch Generation Limit</label>
          <input type="number" v-model.number="store.batchLimit" class="sm-input" min="1" max="50" />
       </div>
    </div>
  </div>
</template>

<style scoped>
.property-sidebar {
  padding: 1.5rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: var(--col-text-main);
  box-sizing: border-box;
}

h3 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  padding-bottom: 0.5rem;
  font-size: 1.1rem;
}

.prop-group {
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.prop-group label {
  color: var(--col-text-muted);
  font-size: 0.9rem;
}

.speed-control {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.time-inputs {
  display: flex;
  gap: 1rem;
}

.sm-input {
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--col-border);
  color: var(--col-text-main);
  padding: 0.4rem;
  width: 70px;
  border-radius: 4px;
}
.sm-input:focus {
    border-color: var(--col-primary);
    outline: none;
}

.sub-label {
    display: block;
    font-size: 0.75rem;
    color: var(--col-text-muted);
    margin-bottom: 0.2rem;
}

.status-badge {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
}
.status-badge.done { background: rgba(0, 255, 100, 0.2); color: #40ff80; }
.status-badge.loading { background: rgba(255, 200, 0, 0.2); color: #ffca40; }
.status-badge.error { background: rgba(255, 50, 50, 0.2); color: #ff6060; }
.status-badge.idle { background: rgba(255, 255, 255, 0.1); color: #ccc; }

.empty-selection {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--col-text-muted);
    font-style: italic;
    font-size: 0.9rem;
}

.admin-panel {
    margin-top: auto;
    border-top: 1px solid rgba(255,255,255,0.1);
    padding-top: 1rem;
}

.info-text {
    font-size: 0.8rem;
    color: var(--col-text-muted);
}

input[type=range] {
  flex: 1;
}
</style>
