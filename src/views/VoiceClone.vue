<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { saveVoice, getVoices, getVoicePreview, deleteVoice, renameVoice, exportVoice, getVoiceDetails, type VoiceDetails } from '../api/voices';
import { 
  Upload, Mic, RefreshCw, Play, Pause, Trash2, 
  MoreVertical, Loader2, Edit2, Download, Info,
  FileAudio
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
    if (currentPlayingVoice.value === voiceName && isPlaying.value) {
        pauseAudio();
        return;
    }

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

const handleRename = async (voiceName: string) => {
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

onMounted(() => {
    fetchVoices();
});

onUnmounted(() => {
    if (audioElement.value) {
        audioElement.value.pause();
        audioElement.value = null;
    }
});
</script>

<template>
  <div class="h-[calc(100vh-3.5rem)] flex overflow-hidden bg-muted/10">
    <!-- Sidebar: Voice Library -->
    <aside class="w-80 md:w-96 border-r bg-background flex flex-col shrink-0">
      <div class="p-4 border-b flex items-center justify-between bg-muted/20">
        <div>
          <h2 class="text-lg font-bold tracking-tight">Voice Library</h2>
          <p class="text-xs text-muted-foreground">Your custom models</p>
        </div>
        <Button variant="ghost" size="icon" @click="fetchVoices" :disabled="loadingList" class="h-8 w-8 hover:bg-muted">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loadingList }" />
        </Button>
      </div>
      
      <ScrollArea class="flex-1">
        <div v-if="loadingList && !voices.length" class="flex flex-col items-center justify-center h-40 space-y-4">
          <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
          <p class="text-sm text-muted-foreground">Refreshing library...</p>
        </div>
        
        <div v-else-if="voices.length === 0" class="flex flex-col items-center justify-center h-60 text-center p-8 space-y-3">
          <div class="p-3 bg-muted rounded-full">
            <Mic class="h-6 w-6 text-muted-foreground opacity-50" />
          </div>
          <p class="text-sm text-muted-foreground">No custom voices yet. Create your first clone!</p>
        </div>

        <div v-else class="divide-y">
          <div 
            v-for="v in voices" 
            :key="v" 
            class="group relative flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors cursor-default"
            :class="{ 'bg-primary/5': currentPlayingVoice === v }"
          >
            <!-- Progress Indicator -->
            <div 
              v-if="currentPlayingVoice === v" 
              class="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-100" 
              :style="{ width: audioProgress + '%' }"
            ></div>

            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground border shadow-sm">
              {{ v.charAt(0).toUpperCase() }}
            </div>
            
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold truncate">{{ v }}</p>
                <Badge variant="secondary" class="text-[10px] px-1.5 py-0 h-4 font-normal">Custom</Badge>
              </div>
              <p class="text-xs text-muted-foreground mt-0.5">Model ready</p>
            </div>

            <div class="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                class="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary"
                @click.stop="playPreview(v)"
                :disabled="loadingPreview === v"
              >
                <Loader2 v-if="loadingPreview === v" class="h-4 w-4 animate-spin" />
                <Pause v-else-if="currentPlayingVoice === v && isPlaying" class="h-4 w-4 fill-current" />
                <Play v-else class="h-4 w-4 fill-current" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-40">
                  <DropdownMenuLabel>Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem @click="handleRename(v)">
                    <Edit2 class="mr-2 h-3.5 w-3.5" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="handleExport(v)">
                    <Download class="mr-2 h-3.5 w-3.5" />
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="handleDetails(v)">
                    <Info class="mr-2 h-3.5 w-3.5" />
                    Details
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem class="text-destructive focus:bg-destructive/10 focus:text-destructive" @click="handleDelete(v)">
                    <Trash2 class="mr-2 h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>

    <!-- Main Content: Voice Cloning Form -->
    <main class="flex-1 overflow-y-auto bg-muted/5">
      <div class="max-w-4xl mx-auto p-6 md:p-12">
        <div class="mb-8">
          <h1 class="text-3xl font-bold tracking-tight mb-2">Voice Cloning</h1>
          <p class="text-muted-foreground text-lg">
            Create a high-fidelity digital clone of any voice from a short audio sample.
          </p>
        </div>

        <Card class="shadow-xl border-muted rounded-xl overflow-hidden">
          <CardHeader class="bg-muted/30 border-b">
            <CardTitle class="text-xl font-bold">New Voice Model</CardTitle>
            <CardDescription>Configure your cloning parameters below.</CardDescription>
          </CardHeader>
          <CardContent class="p-8">
            <form @submit.prevent="submit" class="space-y-8">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="space-y-4">
                  <div class="space-y-2">
                    <Label for="voice-name" class="text-sm font-bold uppercase tracking-wider text-muted-foreground">Voice Name</Label>
                    <Input 
                      id="voice-name" 
                      v-model="name" 
                      placeholder="e.g. My Narrator" 
                      required 
                      class="h-12 bg-muted/30 border-muted focus-visible:ring-primary/30"
                    />
                  </div>

                  <div class="space-y-2">
                    <Label class="text-sm font-bold uppercase tracking-wider text-muted-foreground">Reference Audio</Label>
                    <div 
                      class="group relative flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-xl p-8 transition-all hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                      :class="{ 'border-primary/50 bg-primary/5': !!file }"
                      @click="fileInput?.click()"
                    >
                      <input type="file" ref="fileInput" @change="handleFileChange" accept="audio/*" hidden />
                      
                      <template v-if="!file">
                        <div class="p-4 bg-muted rounded-full group-hover:scale-110 transition-transform shadow-sm">
                          <Upload class="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div class="mt-4 text-center">
                          <p class="text-sm font-semibold">Upload Sample</p>
                          <p class="text-xs text-muted-foreground mt-1">WAV, MP3 up to 10MB</p>
                        </div>
                      </template>
                      
                      <template v-else>
                        <div class="p-4 bg-primary/20 rounded-full shadow-sm">
                          <FileAudio class="h-6 w-6 text-primary" />
                        </div>
                        <div class="mt-4 text-center">
                          <p class="text-sm font-bold truncate max-w-[200px]">{{ file.name }}</p>
                          <p class="text-xs text-primary font-medium mt-1">{{ (file.size / 1024 / 1024).toFixed(2) }} MB</p>
                        </div>
                        <Button variant="outline" size="sm" class="mt-4 h-8 text-xs bg-background">Change File</Button>
                      </template>
                    </div>
                  </div>
                </div>

                <div class="space-y-2 flex flex-col">
                  <Label for="transcript" class="text-sm font-bold uppercase tracking-wider text-muted-foreground">Transcript Reference</Label>
                  <textarea 
                    id="transcript"
                    v-model="refText" 
                    class="flex-1 min-h-[220px] w-full rounded-xl border border-muted bg-muted/30 px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 font-mono resize-none" 
                    placeholder="Enter the exact text spoken in the audio for better alignment..." 
                    required
                  ></textarea>
                  <div class="flex items-center gap-2 mt-2 px-1">
                    <Info class="h-3.5 w-3.5 text-muted-foreground" />
                    <p class="text-[0.75rem] text-muted-foreground italic">Accuracy is critical for high quality cloning results.</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div class="flex justify-end pt-2">
                <Button type="submit" :disabled="loading" class="w-full md:w-auto min-w-[240px] h-14 text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <Loader2 v-if="loading" class="mr-3 h-5 w-5 animate-spin" />
                  <Mic v-else class="mr-3 h-5 w-5" />
                  Start Cloning Process
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  </div>

    <!-- Details Modal -->
    <Dialog :open="showDetailsModal" @update:open="showDetailsModal = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Voice Details</DialogTitle>
          <DialogDescription>
            Metadata and technical details for this voice model.
          </DialogDescription>
        </DialogHeader>
        
        <div v-if="loadingDetails" class="flex items-center justify-center p-8">
          <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
        
        <div v-else-if="detailedVoice" class="space-y-4 py-4">
          <div class="grid grid-cols-3 items-center gap-4">
            <Label class="text-right text-muted-foreground uppercase text-[10px] tracking-wider">Name</Label>
            <div class="col-span-2 text-sm font-medium">{{ detailedVoice.name }}</div>
          </div>
          <Separator />
          <div class="grid grid-cols-3 items-center gap-4">
            <Label class="text-right text-muted-foreground uppercase text-[10px] tracking-wider">File Size</Label>
            <div class="col-span-2 text-sm font-medium">{{ (detailedVoice.size_bytes / 1024 / 1024).toFixed(2) }} MB</div>
          </div>
          <Separator />
          <div class="grid grid-cols-3 items-center gap-4">
            <Label class="text-right text-muted-foreground uppercase text-[10px] tracking-wider">Created</Label>
            <div class="col-span-2 text-sm font-medium">{{ new Date(detailedVoice.created_at * 1000).toLocaleString() }}</div>
          </div>
          <Separator />
          <div class="grid grid-cols-3 items-center gap-4">
            <Label class="text-right text-muted-foreground uppercase text-[10px] tracking-wider">Modified</Label>
            <div class="col-span-2 text-sm font-medium">{{ new Date(detailedVoice.modified_at * 1000).toLocaleString() }}</div>
          </div>
        </div>
        
        <div class="flex justify-end">
          <Button variant="outline" @click="showDetailsModal = false">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
</template>

<style scoped>
/* Custom overrides if needed, but mostly handled by Tailwind */
.truncate {
  max-width: 100%;
}
</style>
