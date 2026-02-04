<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { saveVoice, getVoices, getVoicePreview, deleteVoice, renameVoice, exportVoice, getVoiceDetails, type VoiceDetails } from '../api/voices';
import BaseInput from '../components/ui/BaseInput.vue';
import BaseButton from '../components/ui/BaseButton.vue';
import { Upload, Mic, RefreshCw, Play, Pause, Trash2, MoreVertical, Loader, Edit2, Download, Info, X } from 'lucide-vue-next';

const name = ref('');
const refText = ref('');
const file = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const loading = ref(false);
const loadingList = ref(false);
const errorMsg = ref('');
const voices = ref<string[]>([]);

// Audio Player State
const currentPlayingVoice = ref<string | null>(null);
const isPlaying = ref(false);
const audioProgress = ref(0);
const audioElement = ref<HTMLAudioElement | null>(null);
const loadingPreview = ref<string | null>(null);

// Context Menu State
const showContextMenu = ref<string | null>(null);
const contextMenuPos = ref({ x: 0, y: 0 });
const scrollContainer = ref<HTMLElement | null>(null);

// Details Modal State
const showDetailsModal = ref(false);
const detailedVoice = ref<VoiceDetails | null>(null);
const loadingDetails = ref(false);

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
        alert('Failed to clone voice. ' + ((err as any).response?.data?.detail || (err as any).message));
    } finally {
        loading.value = false;
    }
};

// Audio Player Functions
const playPreview = async (voiceName: string) => {
    // 이미 재생 중인 경우 일시정지
    if (currentPlayingVoice.value === voiceName && isPlaying.value) {
        pauseAudio();
        return;
    }

    // 다른 음성을 재생 중이면 정지
    if (audioElement.value) {
        audioElement.value.pause();
        audioElement.value = null;
    }

    loadingPreview.value = voiceName;
    currentPlayingVoice.value = voiceName;
    audioProgress.value = 0;

    try {
        const res = await getVoicePreview(voiceName);
        const blob = new Blob([res.data], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);

        audioElement.value = new Audio(url);
        audioElement.value.addEventListener('timeupdate', updateProgress);
        audioElement.value.addEventListener('ended', onAudioEnded);
        audioElement.value.addEventListener('loadedmetadata', () => {
            loadingPreview.value = null;
        });

        await audioElement.value.play();
        isPlaying.value = true;
    } catch (err) {
        console.error('Failed to play preview:', err);
        loadingPreview.value = null;
        currentPlayingVoice.value = null;
    }
};

const pauseAudio = () => {
    if (audioElement.value) {
        audioElement.value.pause();
        isPlaying.value = false;
    }
};

const updateProgress = () => {
    if (audioElement.value) {
        const progress = (audioElement.value.currentTime / audioElement.value.duration) * 100;
        audioProgress.value = progress;
    }
};

const onAudioEnded = () => {
    isPlaying.value = false;
    audioProgress.value = 0;
    currentPlayingVoice.value = null;
};

const handleDelete = async (voiceName: string) => {
    if (!confirm(`'${voiceName}' 보이스를 삭제하시겠습니까?`)) return;

    try {
        await deleteVoice(voiceName);
        // 재생 중이면 정지
        if (currentPlayingVoice.value === voiceName) {
            if (audioElement.value) {
                audioElement.value.pause();
                audioElement.value = null;
            }
            currentPlayingVoice.value = null;
            isPlaying.value = false;
        }
        await fetchVoices();
    } catch (err) {
        console.error('Failed to delete voice:', err);
        alert('Failed to delete voice.');
    }
};

const toggleContextMenu = (voiceName: string, event: MouseEvent) => {
    event.preventDefault(); // Prevent default context menu if right clicked, though we use left click here
    event.stopPropagation();
    
    if (showContextMenu.value === voiceName) {
        showContextMenu.value = null;
        return;
    }

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    // Position menu: below the button, aligned to the right edge
    contextMenuPos.value = {
        x: rect.right,
        y: rect.bottom + 4
    };
    
    showContextMenu.value = voiceName;
};

const handleScroll = () => {
    if (showContextMenu.value) {
        closeContextMenu();
    }
};

const handleRename = async (voiceName: string) => {
    closeContextMenu();
    const newName = prompt('Enter new voice name:', voiceName);
    if (!newName || newName === voiceName) return;
    
    try {
        await renameVoice(voiceName, newName);
        await fetchVoices();
    } catch (err: any) {
        console.error('Failed to rename voice:', err);
        alert('Failed to rename voice. ' + (err.response?.data?.detail || err.message));
    }
};

const handleExport = async (voiceName: string) => {
    closeContextMenu();
    try {
        const res = await exportVoice(voiceName);
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${voiceName}.pt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (err: any) {
        console.error('Failed to export voice:', err);
        alert('Failed to export voice.');
    }
};

const handleDetails = async (voiceName: string) => {
    closeContextMenu();
    detailedVoice.value = null;
    showDetailsModal.value = true;
    loadingDetails.value = true;
    
    try {
        const res = await getVoiceDetails(voiceName);
        detailedVoice.value = res.data;
    } catch (err: any) {
        console.error('Failed to get voice details:', err);
        alert('Failed to load details.');
        showDetailsModal.value = false;
    } finally {
        loadingDetails.value = false;
    }
};

const closeContextMenu = () => {
    showContextMenu.value = null;
};

onMounted(() => {
    fetchVoices();
    document.addEventListener('click', closeContextMenu);
    if (scrollContainer.value) {
        scrollContainer.value.addEventListener('scroll', handleScroll);
    }
});

onUnmounted(() => {
    document.removeEventListener('click', closeContextMenu);
    if (scrollContainer.value) {
        scrollContainer.value.removeEventListener('scroll', handleScroll);
    }
    if (audioElement.value) {
        audioElement.value.pause();
        audioElement.value = null;
    }
});
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
            
            <div class="panel-content scrollable" ref="scrollContainer">
                 <div v-if="loadingList" class="loading-state">
                    Loading...
                 </div>
                 <div v-else-if="voices.length === 0" class="empty-state">
                    <p>No custom voices yet.</p>
                 </div>
                 <ul v-else class="voice-list">
                    <li 
                        v-for="v in voices" 
                        :key="v" 
                        class="voice-item"
                        :class="{ 'is-playing': currentPlayingVoice === v }"
                    >
                        <!-- Progress Bar Background -->
                        <div 
                            v-if="currentPlayingVoice === v" 
                            class="progress-bar" 
                            :style="{ width: audioProgress + '%' }"
                        ></div>
                        
                        <div class="voice-avatar">
                            <span>{{ v.charAt(0).toUpperCase() }}</span>
                        </div>
                        <div class="voice-info">
                            <span class="voice-name">{{ v }}</span>
                            <span class="voice-type">Custom Model</span>
                        </div>
                        <div class="voice-actions">
                            <!-- Play/Pause Button -->
                            <button 
                                class="action-icon-btn play-btn" 
                                @click.stop="playPreview(v)"
                                :disabled="loadingPreview === v"
                                :title="currentPlayingVoice === v && isPlaying ? 'Pause' : 'Play Preview'"
                            >
                                <Loader v-if="loadingPreview === v" :size="14" class="spin" />
                                <Pause v-else-if="currentPlayingVoice === v && isPlaying" :size="14" />
                                <Play v-else :size="14" />
                            </button>
                            
                            <!-- Delete Button -->
                            <button 
                                class="action-icon-btn delete-btn" 
                                @click.stop="handleDelete(v)"
                                title="Delete"
                            >
                                <Trash2 :size="14" />
                            </button>
                            
                            <!-- More Options -->
                            <div class="more-menu-wrapper">
                                <button 
                                    class="action-icon-btn more-btn" 
                                    @click="toggleContextMenu(v, $event)"
                                    title="More options"
                                    :class="{ 'active': showContextMenu === v }"
                                >
                                    <MoreVertical :size="14" />
                                </button>
                            </div>
                        </div>
                    </li>
                 </ul>
                 
                 <!-- Global Context Menu -->
                 <Teleport to="body">
                    <div 
                        v-if="showContextMenu" 
                        class="context-menu fixed-menu"
                        :style="{ top: `${contextMenuPos.y}px`, left: `${contextMenuPos.x}px` }"
                        @click.stop
                    >
                        <button class="context-item" @click="handleRename(showContextMenu)">
                            <Edit2 :size="12" /> Rename
                        </button>
                        <button class="context-item" @click="handleExport(showContextMenu)">
                            <Download :size="12" /> Export
                        </button>
                        <button class="context-item" @click="handleDetails(showContextMenu)">
                            <Info :size="12" /> Details
                        </button>
                        <div class="menu-divider"></div>
                        <button class="context-item danger" @click="handleDelete(showContextMenu)">
                            <Trash2 :size="12" /> Delete
                        </button>
                    </div>
                 </Teleport>

                 <!-- Details Modal -->
                 <Teleport to="body">
                     <div v-if="showDetailsModal" class="modal-overlay" @click="showDetailsModal = false">
                         <div class="modal-content glass-panel" @click.stop>
                             <div class="modal-header">
                                 <h3>Voice Details</h3>
                                 <button class="icon-btn" @click="showDetailsModal = false"><X :size="16"/></button>
                             </div>
                             <div class="modal-body">
                                 <div v-if="loadingDetails" class="loading-state">Loading info...</div>
                                 <div v-else-if="detailedVoice" class="details-grid">
                                     <div class="detail-row">
                                         <span class="detail-label">Name</span>
                                         <span class="detail-value">{{ detailedVoice.name }}</span>
                                     </div>
                                     <div class="detail-row">
                                         <span class="detail-label">File Size</span>
                                         <span class="detail-value">{{ (detailedVoice.size_bytes / 1024 / 1024).toFixed(2) }} MB</span>
                                     </div>
                                     <div class="detail-row">
                                         <span class="detail-label">Created</span>
                                         <span class="detail-value">{{ new Date(detailedVoice.created_at * 1000).toLocaleString() }}</span>
                                     </div>
                                     <div class="detail-row">
                                         <span class="detail-label">Modified</span>
                                         <span class="detail-value">{{ new Date(detailedVoice.modified_at * 1000).toLocaleString() }}</span>
                                     </div>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </Teleport>
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
    display: flex; flex-direction: column; gap: 4px;
}
.voice-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px;
    background: #111;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
    overflow: hidden;
}
.voice-item:hover {
    border-color: var(--col-border);
    background: #161616;
}
.voice-item:hover .voice-actions {
    opacity: 1;
}
.voice-item.is-playing {
    border-color: var(--col-primary);
    background: rgba(var(--hue-primary), 0.08);
}

/* Progress Bar */
.progress-bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: rgba(var(--hue-primary), 0.15);
    pointer-events: none;
    transition: width 0.1s linear;
}

.voice-avatar {
    width: 28px; height: 28px; background: #222; color: #777;
    border-radius: 4px; display: flex; align-items: center; justify-content: center;
    font-weight: 600; font-size: 0.75rem;
    flex-shrink: 0;
    z-index: 1;
}
.voice-info { 
    display: flex; flex-direction: column; flex: 1; min-width: 0; 
    gap: 1px;
    z-index: 1;
}
.voice-name { 
    color: #ddd; font-size: 0.85rem; font-weight: 500; 
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    letter-spacing: 0.01em;
}
.voice-type { 
    color: #555; font-size: 0.7rem; 
    letter-spacing: 0.02em;
}

/* Voice Actions */
.voice-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s ease;
    z-index: 1;
}
.voice-item:hover .voice-actions,
.voice-item.is-playing .voice-actions {
    opacity: 1;
}

.action-icon-btn {
    width: 26px; height: 26px;
    display: flex; align-items: center; justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #666;
    cursor: pointer;
    transition: all 0.15s ease;
}
.action-icon-btn:hover {
    background: #222;
    color: #aaa;
}
.action-icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.play-btn:hover {
    color: var(--col-primary);
}
.delete-btn:hover {
    color: #ff4d4d;
}

/* Context Menu */
.more-menu-wrapper {
    position: relative;
}
.context-menu {
    position: absolute;
    right: 0;
    bottom: 100%;
    margin-bottom: 4px;
    background: #1f1f1f;
    border: 1px solid #333;
    border-radius: var(--radius-sm);
    min-width: 150px;
    padding: 4px;
    z-index: 1000;
    box-shadow: 0 -4px 16px rgba(0,0,0,0.5);
}
.context-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    background: none;
    border: none;
    color: #ccc;
    font-size: 0.8rem;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.15s;
}
.context-item:hover {
    background: #2a2a2a;
    color: #ff4d4d;
}

.empty-state { text-align: center; padding: 2rem; color: #444; font-size: 0.9rem; }
.loading-state { text-align: center; padding: 2rem; color: #555; font-size: 0.85rem; }
.icon-btn { background: none; border: none; color: inherit; cursor: pointer; padding: 4px; }
.icon-btn:hover { color: var(--col-primary); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { 100% { transform: rotate(360deg); } }



/* Updated Context Menu for Fixed Positioning */
.fixed-menu {
    position: fixed;
    left: 0;
    top: 0;
    
    /* Override absolute positioning context */
    right: auto;
    bottom: auto;
    
    transform: translateX(-100%); /* Align right edge to position */
    margin-top: 4px;
    z-index: 9999;
    
    /* Ensure opacity and styling */
    background-color: #1a1a1a; 
    border: 1px solid #333;
    border-radius: 4px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    padding: 4px;
    min-width: 140px;
}

.menu-divider {
    height: 1px;
    background: #333;
    margin: 4px 0;
}

.context-item.danger {
    color: #ff4d4d;
}
.context-item.danger:hover {
    background: rgba(255, 77, 77, 0.1);
}

.more-btn.active {
    color: var(--col-primary);
    background: rgba(255,255,255,0.05);
}

/* Modal Styles */
.modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}
.modal-content {
    width: 400px;
    max-width: 90vw;
    background: #111;
    border: 1px solid #333;
    border-radius: var(--radius-md);
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
}
.modal-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #222;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.modal-header h3 { margin: 0; font-size: 1rem; color: #eee; }
.modal-body { padding: 1.5rem; }

.details-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
.detail-row {
    display: flex;
    justify-content: space-between;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #1a1a1a;
}
.detail-row:last-child { border-bottom: none; }
.detail-label { color: #666; font-size: 0.9rem; }
.detail-value { color: #ccc; font-family: monospace; font-size: 0.9rem; }
</style>
