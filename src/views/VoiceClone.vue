<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { saveVoice, getVoices, getVoicePreview, deleteVoice, renameVoice, exportVoice, getVoiceDetails, type VoiceDetails } from '../api/voices';
import { 
  Upload, Mic, RefreshCw, Play, Pause, Trash2, 
  MoreVertical, Loader2, Edit2, Download, Info,
  FileAudio, Square
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

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

// Recording State
const isRecording = ref(false);
const recordingTime = ref(0);
const mediaRecorder = ref<MediaRecorder | null>(null);
const audioChunks = ref<Blob[]>([]);
let timerInterval: any = null;

const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder.value = new MediaRecorder(stream);
        audioChunks.value = [];

        mediaRecorder.value.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.value.push(e.data);
        };

        mediaRecorder.value.onstop = () => {
            const blob = new Blob(audioChunks.value, { type: 'audio/wav' });
            file.value = new File([blob], `recording-${Date.now()}.wav`, { type: 'audio/wav' });
        };

        mediaRecorder.value.start();
        isRecording.value = true;
        recordingTime.value = 0;
        timerInterval = setInterval(() => {
            recordingTime.value++;
        }, 1000);
    } catch (err) {
        console.error('Error opening microphone:', err);
        if (window.isSecureContext === false) {
           alert('마이크 접근은 보안 연결(HTTPS 또는 localhost)에서만 가능합니다.\n현재 IP 주소로 접속 중이라면 http://localhost:5173 으로 접속하시거나, 브라우저 설정에서 해당 원본을 안전한 곳으로 등록해주세요.');
        } else {
           alert('마이크에 접근할 수 없습니다. 권한 설정을 확인해주세요.');
        }
    }
};

const stopRecording = () => {
    if (mediaRecorder.value && isRecording.value) {
        mediaRecorder.value.stop();
        isRecording.value = false;
        clearInterval(timerInterval);
        mediaRecorder.value.stream.getTracks().forEach(t => t.stop());
    }
};

const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

onMounted(() => {
    fetchVoices();
});

onUnmounted(() => {
    if (audioElement.value) {
        audioElement.value.pause();
        audioElement.value = null;
    }
    if (isRecording.value) {
        stopRecording();
    }
});
</script>

<template>
  <div class="h-[calc(100vh-4rem)] flex overflow-hidden bg-background">
    <!-- Sidebar: Voice Library -->
    <aside class="w-80 md:w-96 border-r flex flex-col shrink-0 bg-muted/30">
      <div class="p-6 border-b flex items-center justify-between bg-background/50 backdrop-blur-sm">
        <div class="space-y-1">
          <h2 class="text-xl font-display font-bold tracking-tight">Voice Library</h2>
          <p class="text-xs text-muted-foreground font-medium uppercase tracking-wider">Your custom models</p>
        </div>
        <Button variant="outline" size="icon" @click="fetchVoices" :disabled="loadingList" class="h-9 w-9 rounded-xl hover:bg-background hover:text-primary transition-all">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loadingList }" />
        </Button>
      </div>
      
      <ScrollArea class="flex-1">
        <div v-if="loadingList && !voices.length" class="flex flex-col items-center justify-center h-48 space-y-4">
          <Loader2 class="h-10 w-10 animate-spin text-primary/60" />
          <p class="text-sm font-medium text-muted-foreground">Refreshing library...</p>
        </div>
        
        <div v-else-if="voices.length === 0" class="flex flex-col items-center justify-center h-80 text-center p-10 space-y-4">
          <div class="p-5 bg-muted/50 rounded-2xl shadow-inner border border-muted">
            <Mic class="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div class="space-y-1">
            <p class="text-sm font-bold">No custom voices yet</p>
            <p class="text-xs text-muted-foreground px-4">Create your first high-quality voice clone to see it here.</p>
          </div>
        </div>

        <div v-else class="p-4 space-y-2">
          <div 
            v-for="v in voices" 
            :key="v" 
            class="group relative flex items-center gap-4 p-4 rounded-xl hover:bg-background hover:shadow-md transition-all border border-transparent hover:border-border cursor-default"
            :class="{ 'bg-background shadow-sm border-border': currentPlayingVoice === v }"
          >
            <!-- Progress Indicator -->
            <div 
              v-if="currentPlayingVoice === v" 
              class="absolute bottom-0 left-4 right-4 h-0.5 bg-primary/20 rounded-full overflow-hidden"
            >
              <div class="h-full bg-primary transition-all duration-100" :style="{ width: audioProgress + '%' }"></div>
            </div>

            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 font-display font-bold text-primary border border-primary/10 shadow-sm">
              {{ v.charAt(0).toUpperCase() }}
            </div>
            
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-sm font-bold truncate tracking-tight text-foreground/90">{{ v }}</p>
                <Badge variant="secondary" class="text-[9px] px-1.5 py-0 h-4 font-bold uppercase tracking-widest bg-primary/5 text-primary border-primary/10">Custom</Badge>
              </div>
              <p class="text-[11px] font-medium text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                Model ready
              </p>
            </div>

            <div class="flex items-center gap-1.5">
              <Button 
                variant="ghost" 
                size="icon" 
                class="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors shadow-sm bg-background border border-border"
                @click.stop="playPreview(v)"
                :disabled="loadingPreview === v"
              >
                <Loader2 v-if="loadingPreview === v" class="h-4 w-4 animate-spin text-primary" />
                <Pause v-else-if="currentPlayingVoice === v && isPlaying" class="h-4 w-4 fill-current" />
                <Play v-else class="h-4 w-4 fill-current" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-9 w-9 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-accent border border-transparent hover:border-border">
                    <MoreVertical class="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-48 p-1 rounded-xl">
                  <DropdownMenuLabel class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 py-1.5">Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem @click="handleRename(v)" class="rounded-lg gap-3 focus:bg-primary/5 focus:text-primary py-2.5">
                    <Edit2 class="h-4 w-4" />
                    <span class="font-medium">Rename Voice</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="handleExport(v)" class="rounded-lg gap-3 focus:bg-primary/5 focus:text-primary py-2.5">
                    <Download class="h-4 w-4" />
                    <span class="font-medium">Export .PT File</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="handleDetails(v)" class="rounded-lg gap-3 focus:bg-primary/5 focus:text-primary py-2.5">
                    <Info class="h-4 w-4" />
                    <span class="font-medium">View Details</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem class="text-destructive rounded-lg gap-3 focus:bg-destructive/5 focus:text-destructive py-2.5" @click="handleDelete(v)">
                    <Trash2 class="h-4 w-4" />
                    <span class="font-medium">Delete Model</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>

    <!-- Main Content: Voice Cloning Form -->
    <main class="flex-1 overflow-y-auto bg-muted/10">
      <div class="max-w-5xl mx-auto p-8 md:p-12">
        <div class="mb-10 space-y-2">
          <h1 class="text-4xl font-display font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70">Voice Cloning</h1>
          <p class="text-muted-foreground text-lg font-medium leading-relaxed max-w-2xl">
            Create a high-fidelity digital clone of any voice from a short audio sample in seconds.
          </p>
        </div>

        <Card class="shadow-2xl border-border bg-card/50 backdrop-blur-xl rounded-2xl overflow-hidden border-t-4 border-t-primary/40">
          <CardHeader class="bg-muted/30 border-b p-8 space-y-1">
            <CardTitle class="text-2xl font-display font-bold">New Voice Model</CardTitle>
            <CardDescription class="text-sm font-medium">Configure your cloning parameters for optimal results.</CardDescription>
          </CardHeader>
          <CardContent class="p-10">
            <form @submit.prevent="submit" class="space-y-10">
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div class="space-y-8">
                  <div class="space-y-3">
                    <Label for="voice-name" class="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/80 flex items-center gap-2">
                      <span class="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                      Voice Name
                    </Label>
                    <Input 
                      id="voice-name" 
                      v-model="name" 
                      placeholder="e.g. Cinematic Narrator" 
                      required 
                      class="h-14 bg-background border-border focus-visible:ring-primary/20 focus-visible:border-primary/50 text-base font-medium rounded-xl px-5 transition-all shadow-sm"
                    />
                  </div>

                  <div class="space-y-4">
                    <Label class="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/80 flex items-center gap-2">
                       <span class="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                       Reference Audio
                    </Label>
                    <Tabs default-value="upload" class="w-full">
                      <TabsList class="grid w-full grid-cols-2 p-1.5 bg-muted/50 rounded-xl h-12 mb-6 shadow-inner">
                        <TabsTrigger value="upload" class="flex flex-col items-center justify-center gap-1.5 h-full rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary group/tab">
                          <Upload class="h-4 w-4 transition-transform group-data-[state=active]/tab:scale-110" />
                          <span>Upload File</span>
                        </TabsTrigger>
                        <TabsTrigger value="record" class="flex flex-col items-center justify-center gap-1.5 h-full rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-red-500 group/tab">
                          <Mic class="h-4 w-4 transition-transform group-data-[state=active]/tab:scale-110" />
                          <span>Record Live</span>
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="upload" class="mt-0 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <div 
                          class="group relative flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-2xl p-10 transition-all hover:border-primary/40 hover:bg-primary/5 cursor-pointer min-h-[220px] shadow-sm bg-background/50"
                          :class="{ 'border-primary/60 bg-primary/10 shadow-lg ring-2 ring-primary/5': !!file && !isRecording && !file.name.startsWith('recording-') }"
                          @click="fileInput?.click()"
                        >
                          <input type="file" ref="fileInput" @change="handleFileChange" accept="audio/*" hidden />
                          
                          <template v-if="!file || isRecording || file.name.startsWith('recording-')">
                            <div class="p-6 bg-card rounded-2xl group-hover:scale-110 transition-all shadow-md group-hover:shadow-lg border border-border group-hover:border-primary/40">
                              <Upload class="h-10 w-10 text-primary/80" />
                            </div>
                            <div class="mt-6 text-center space-y-1.5">
                              <p class="text-base font-bold">Drop your audio here</p>
                              <p class="text-xs font-medium text-muted-foreground tracking-wide">WAV, MP3, M4A (Max 10MB)</p>
                            </div>
                          </template>
                          
                          <template v-else>
                            <div class="p-6 bg-primary rounded-2xl shadow-xl shadow-primary/20">
                              <FileAudio class="h-10 w-10 text-primary-foreground" />
                            </div>
                            <div class="mt-6 text-center space-y-2">
                              <p class="text-base font-extrabold truncate max-w-[260px] text-foreground">{{ file.name }}</p>
                              <div class="flex items-center gap-2 justify-center">
                                <Badge variant="outline" class="bg-background/80 text-primary font-bold border-primary/20">{{ (file.size / 1024 / 1024).toFixed(2) }} MB</Badge>
                                <span class="text-[10px] font-bold text-muted-foreground uppercase">Ready to clone</span>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" class="mt-6 h-9 text-xs font-bold px-5 bg-background shadow-sm hover:bg-muted border-border transition-colors">Change Reference</Button>
                          </template>
                        </div>
                      </TabsContent>

                      <TabsContent value="record" class="mt-0 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <div 
                          class="flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-2xl p-10 transition-all min-h-[220px] shadow-sm bg-background/50"
                          :class="{ 'border-red-500/50 bg-red-500/10 shadow-lg ring-2 ring-red-500/5': isRecording, 'border-primary/60 bg-primary/10 shadow-lg ring-2 ring-primary/5': !!file && !isRecording && file.name.startsWith('recording-') }"
                        >
                          <template v-if="!isRecording && (!file || !file.name.startsWith('recording-'))">
                             <div 
                              class="p-8 bg-red-500/10 rounded-full hover:scale-110 transition-all cursor-pointer shadow-md border border-red-500/20 group hover:border-red-500/50"
                              @click="startRecording"
                            >
                              <Mic class="h-12 w-12 text-red-500 group-hover:animate-pulse" />
                            </div>
                            <div class="mt-6 text-center space-y-1.5">
                              <p class="text-base font-bold">Record via Microphone</p>
                              <p class="text-xs font-medium text-muted-foreground text-center max-w-[200px]">Capture 15-30 seconds of speech for best quality</p>
                            </div>
                          </template>

                          <template v-else-if="isRecording">
                            <div class="flex flex-col items-center space-y-6">
                               <div class="relative">
                                  <div class="absolute inset-0 animate-ping rounded-full bg-red-500/20 scale-150"></div>
                                  <div class="p-8 bg-red-500 rounded-full relative z-10 cursor-pointer shadow-2xl transition-transform hover:scale-95" @click="stopRecording">
                                    <Square class="h-10 w-10 text-white fill-current" />
                                  </div>
                               </div>
                               <div class="text-center space-y-1">
                                  <p class="text-4xl font-mono font-extrabold text-foreground tabular-nums tracking-tighter">{{ formatTime(recordingTime) }}</p>
                                  <p class="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] mt-1 flex items-center gap-2 justify-center">
                                    <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                    Recording Live
                                  </p>
                               </div>
                               <Button variant="destructive" size="lg" class="px-8 font-bold shadow-lg shadow-red-500/20" @click="stopRecording">Stop Recording</Button>
                            </div>
                          </template>

                          <template v-else>
                              <div class="p-6 bg-primary rounded-2xl shadow-xl shadow-primary/20">
                                  <FileAudio class="h-10 w-10 text-primary-foreground" />
                              </div>
                              <div class="mt-6 text-center space-y-2">
                                  <p class="text-base font-extrabold truncate max-w-[260px] text-foreground italic">"{{ file.name }}"</p>
                                  <div class="flex items-center gap-2 justify-center">
                                    <Badge variant="outline" class="bg-background/80 text-primary font-bold border-primary/20">{{ (file.size / 1024).toFixed(1) }} KB</Badge>
                                    <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">RECORDED VOICE</span>
                                  </div>
                              </div>
                              <Button variant="outline" size="sm" class="mt-6 h-9 text-xs font-bold px-5 bg-background shadow-sm hover:bg-muted border-border transition-colors" @click="startRecording">Record New Take</Button>
                          </template>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>

                <div class="space-y-3 flex flex-col">
                  <Label for="transcript" class="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/80 flex items-center gap-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                    Transcript Reference
                  </Label>
                  <textarea 
                    id="transcript"
                    v-model="refText" 
                    class="flex-1 min-h-[350px] w-full rounded-2xl border-2 border-muted bg-background/50 px-6 py-5 text-base ring-offset-background placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50 font-sans leading-relaxed resize-none transition-all shadow-inner" 
                    placeholder="Type or paste the exact words spoken in your audio sample. This is used to align the AI model with the speech patterns..." 
                    required
                  ></textarea>
                  <div class="flex items-center gap-3 mt-4 px-3 py-3 bg-primary/5 rounded-xl border border-primary/10">
                    <Info class="h-4 w-4 text-primary" />
                    <p class="text-xs text-primary/80 font-medium italic">Accuracy is crucial—the AI needs to know exactly what was said to learn the speaker's nuance.</p>
                  </div>
                </div>
              </div>

              <div class="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              <div class="flex flex-col items-center pt-2">
                <Button 
                    type="submit" 
                    :disabled="loading" 
                    class="w-full md:w-auto min-w-[320px] h-16 text-xl font-display font-extrabold shadow-2xl shadow-primary/40 transition-all hover:scale-[1.03] hover:shadow-primary/50 active:scale-[0.97] rounded-2xl bg-primary text-primary-foreground group"
                >
                  <Loader2 v-if="loading" class="mr-3 h-6 w-6 animate-spin" />
                  <Mic v-else class="mr-3 h-6 w-6 group-hover:animate-bounce transition-transform" />
                  <span>Start Cloning Process</span>
                </Button>
                <p class="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-[0.3em]">Estimated time: ~1 minute</p>
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
