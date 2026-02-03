<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { saveVoice, getVoices } from '../api/voices';
import BaseInput from '../components/ui/BaseInput.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import { Upload, Mic, RefreshCw } from 'lucide-vue-next';

const name = ref('');
const refText = ref('');
const file = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const loading = ref(false);
const loadingList = ref(false);
const errorMsg = ref('');
const voices = ref<string[]>([]);

const fetchVoices = async () => {
    loadingList.value = true;
    errorMsg.value = '';
    try {
        const res = await getVoices();
        voices.value = res.data;
    } catch (err: any) {
        console.error(err);
        errorMsg.value = 'Failed to load voices. ' + (err.message || '');
    } finally {
        loadingList.value = false;
    }
};

const handleFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        file.value = target.files[0];
    }
};

const submit = async () => {
    if (!name.value || !refText.value || !file.value) return;

    loading.value = true;
    try {
        await saveVoice(name.value, refText.value, file.value);
        // Reset
        name.value = '';
        refText.value = '';
        file.value = null;
        await fetchVoices();
    } catch (err) {
        console.error(err);
        alert('Failed to clone voice.');
    } finally {
        loading.value = false;
    }
};

onMounted(fetchVoices);
</script>

<template>
    <div class="clone-studio-layout">
        <!-- Main Work Area (Left) -->
        <div class="work-panel glass-panel">
            <div class="panel-header">
                <h3>Voice Cloning</h3>
            </div>
            
            <div class="panel-content scrollable">
                <form @submit.prevent="submit" class="clone-form">
                    <div class="form-section">
                        <label class="section-label">Identity</label>
                        <BaseInput v-model="name" label="Voice Name" placeholder="e.g. My Narrator" required class="stealth-input"/>
                    </div>

                    <div class="form-section">
                        <label class="section-label">Reference Audio</label>
                        
                        <div class="audio-uploader" :class="{ 'has-file': !!file }" @click="fileInput?.click()">
                            <input type="file" ref="fileInput" @change="handleFileChange" accept="audio/*" hidden />
                            
                            <div v-if="!file" class="upload-placeholder">
                                <div class="icon-circle">
                                    <Upload :size="20" />
                                </div>
                                <div class="text-group">
                                    <span class="main-text">Upload Reference Audio</span>
                                    <span class="sub-text">WAV or MP3 (Max 10MB)</span>
                                </div>
                            </div>
                            
                            <div v-else class="file-ready">
                                <div class="file-icon">
                                    <Mic :size="20" />
                                </div>
                                <div class="file-details">
                                    <span class="filename">{{ file.name }}</span>
                                    <span class="filesize">{{ (file.size / 1024 / 1024).toFixed(2) }} MB</span>
                                </div>
                                <div class="change-btn">Change</div>
                            </div>
                        </div>
                    </div>

                    <div class="form-section flex-grow">
                        <label class="section-label">Transcript Reference</label>
                        <textarea 
                            v-model="refText" 
                            class="stealth-textarea" 
                            placeholder="Enter the exact text spoken in the audio for better alignment..." 
                            required
                        ></textarea>
                        <p class="hint">Accuracy is key for high quality cloning.</p>
                    </div>

                    <div class="form-actions">
                        <BaseButton type="submit" :loading="loading" variant="primary" class="action-btn">
                            <Mic :size="16" /> Start Cloning Process
                        </BaseButton>
                    </div>
                </form>
            </div>
        </div>

        <!-- Library Panel (Right) -->
        <div class="library-panel glass-panel">
            <div class="panel-header">
                <h3>Voice Library</h3>
                <button class="icon-btn" @click="fetchVoices" :disabled="loadingList">
                    <RefreshCw :size="14" :class="{ 'spin': loadingList }" />
                </button>
            </div>
            
            <div class="panel-content scrollable">
                 <div v-if="loadingList" class="loading-state">
                    Loading...
                 </div>
                 <div v-else-if="voices.length === 0" class="empty-state">
                    <p>No custom voices yet.</p>
                 </div>
                 <ul v-else class="voice-list">
                    <li v-for="v in voices" :key="v" class="voice-item">
                        <div class="voice-avatar">
                            <span>{{ v.charAt(0).toUpperCase() }}</span>
                        </div>
                        <div class="voice-info">
                            <span class="voice-name">{{ v }}</span>
                            <span class="voice-type">Custom Model</span>
                        </div>
                        <div class="voice-actions">
                            <!-- Placeholder for delete/edit -->
                        </div>
                    </li>
                 </ul>
            </div>
        </div>
    </div>
</template>

<style scoped>
.clone-studio-layout {
    display: flex;
    height: 100%;
    gap: 4px; /* Tiny gap for studio feel */
    background: #000;
}

.glass-panel {
    background: #0a0a0a;
    border-right: 1px solid var(--col-border);
}
.glass-panel:last-child {
    border-right: none;
}

.work-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.library-panel {
    width: 300px;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    border-left: 1px solid var(--col-border);
}

.panel-header {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1.5rem;
    border-bottom: 1px solid var(--col-border);
    flex-shrink: 0;
}
.panel-header h3 {
    margin: 0;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--col-text-muted);
}

.panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
}
.scrollable::-webkit-scrollbar { width: 6px; }
.scrollable::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

/* Form Styling */
.clone-form {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 800px;
    margin: 0 auto;
    gap: 2rem;
}

.form-section {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
}

.form-section.flex-grow {
    flex: 1;
}

.section-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--col-text-muted);
    text-transform: uppercase;
}

/* Audio Uploader - Specialized Look */
.audio-uploader {
    border: 1px dashed var(--col-border);
    background: rgba(255,255,255,0.02);
    border-radius: var(--radius-sm);
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
}
.audio-uploader:hover {
    background: rgba(255,255,255,0.04);
    border-color: var(--col-text-muted);
}
.audio-uploader.has-file {
    border-style: solid;
    border-color: var(--col-primary);
    background: rgba(var(--hue-primary), 0.05);
}

.upload-placeholder {
    display: flex; align-items: center; gap: 1rem;
}
.icon-circle {
    width: 40px; height: 40px; border-radius: 50%; background: #222;
    display: flex; align-items: center; justify-content: center; color: #666;
}
.text-group { display: flex; flex-direction: column; }
.main-text { font-size: 0.95rem; font-weight: 500; color: #ccc; }
.sub-text { font-size: 0.8rem; color: #666; }

.file-ready {
    display: flex; align-items: center; gap: 1rem; width: 100%; padding: 0 2rem;
}
.file-icon {
    width: 40px; height: 40px; background: var(--col-primary); color: white;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
}
.file-details { flex: 1; display: flex; flex-direction: column; }
.filename { font-weight: 600; color: white; }
.filesize { font-size: 0.8rem; color: var(--col-primary); opacity: 0.8; }
.change-btn { font-size: 0.8rem; text-decoration: underline; color: #666; }

/* Stealth Inputs */
.stealth-textarea {
    flex: 1;
    background: #111;
    border: 1px solid var(--col-border);
    border-radius: var(--radius-sm);
    padding: 1rem;
    color: var(--col-text-main);
    font-family: monospace;
    font-size: 0.95rem;
    line-height: 1.6;
    resize: none;
    min-height: 200px;
}
.stealth-textarea:focus {
    outline: none;
    border-color: var(--col-primary);
}
.hint { font-size: 0.8rem; color: #555; margin-top: 0.5rem; text-align: right; }


/* Voice List */
.voice-list {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 8px;
}
.voice-item {
    display: flex; align-items: center; gap: 12px;
    padding: 10px;
    background: #111;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s;
}
.voice-item:hover {
    border-color: var(--col-primary);
    background: #151515;
}
.voice-avatar {
    width: 32px; height: 32px; background: #222; color: #888;
    border-radius: 4px; display: flex; align-items: center; justify-content: center;
    font-weight: bold; font-size: 0.8rem;
}
.voice-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.voice-name { color: #ddd; font-size: 0.9rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.voice-type { color: #555; font-size: 0.75rem; }

.empty-state { text-align: center; padding: 2rem; color: #444; font-size: 0.9rem; }
.icon-btn { background: none; border: none; color: inherit; cursor: pointer; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { 100% { transform: rotate(360deg); } }

.action-btn {
    width: 100%;
    padding: 1rem;
    font-size: 1rem;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    font-weight: 600;
}
</style>
