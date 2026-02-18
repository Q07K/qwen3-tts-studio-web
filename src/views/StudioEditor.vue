<script setup lang="ts">
import { onMounted, ref, computed, onUnmounted, watch } from 'vue';
import { useStudioStore } from '../stores/studio';
import { getVoices } from '../api/voices';
import ScriptBlock from '../components/editor/ScriptBlock.vue';
import { 
    Plus, Layers, Play, Pause, 
    Rewind, ZoomIn, ZoomOut,
    SkipForward, Download,
    Loader2,
    Monitor as MonitorIcon,
    Terminal,
    Clock,
    ChevronLeft,
    ChevronRight
} from 'lucide-vue-next';
import { exportAudioProject } from '../utils/audioExport';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const store = useStudioStore();
const voices = ref<string[]>([]);
const loadingVoices = ref(false);
const isExporting = ref(false);
const isSidebarCollapsed = ref(false);

const handleExport = async () => {
    isExporting.value = true;
    try {
        await exportAudioProject(store.blocks, store.projectDuration);
    } catch (e) {
        console.error("Export failed", e);
        alert("Export failed. Please ensure all audio is generated.");
    } finally {
        isExporting.value = false;
    }
};

// Timeline State
const PX_PER_SEC = ref(50);
const timelineDuration = computed(() => Math.max(store.projectDuration + 5, 20));

const isPlaying = computed({
    get: () => store.isPlaying,
    set: (val) => store.isPlaying = val
});
const currentTime = computed({
    get: () => store.currentTime,
    set: (val) => store.seek(val)
});

// Audio Engine State
const audioCache = new Map<string, HTMLAudioElement>(); 
const activeAudios = new Map<string, HTMLAudioElement>(); 
let animationFrameId = 0;
let lastTimestamp = 0;

// Preload Audios
watch(() => store.blocks, (newBlocks) => {
    const currentIds = new Set(newBlocks.map(b => b.id));
    for (const [id, audio] of audioCache.entries()) {
        if (!currentIds.has(id)) {
            if (!audio.paused) audio.pause();
            audioCache.delete(id);
            activeAudios.delete(id);
        }
    }
    
    newBlocks.forEach(block => {
        if (!block.audioUrl || block.status !== 'done') return;
        let audio = audioCache.get(block.id);
        if (!audio) {
            audio = new Audio(block.audioUrl);
            audio.preload = 'auto';
            audioCache.set(block.id, audio);
        } else if (audio.src !== block.audioUrl) {
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

const stopPlayback = () => {
    store.isPlaying = false;
    cancelAnimationFrame(animationFrameId);
    activeAudios.forEach(audio => audio.pause());
    activeAudios.clear();
};

const togglePlayback = () => {
    store.isPlaying = !store.isPlaying;
};

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
    
    const nextTime = store.currentTime + delta;
    store.seek(nextTime);
    
    if (nextTime > timelineDuration.value + 1.0) {
        stopPlayback();
        store.seek(0);
        return;
    }

    store.blocks.forEach(block => {
        if (!block.audioUrl || block.status !== 'done') return;
        const start = Number(block.timelineStart) || 0;
        const speed = Number(block.speed) || 1;
        const trimStart = Number(block.startTime) || 0;
        const trimEnd = Number(block.endTime) || 0;
        const clipDuration = (trimEnd - trimStart) / speed;
        const end = start + clipDuration;
        const cTime = store.currentTime;
        const isInside = cTime >= start && cTime < end;
        
        let audio = audioCache.get(block.id);
        if (isInside && audio) {
            const expectedLocalTime = (cTime - start) * speed + trimStart;
            if (!activeAudios.has(block.id)) {
                audio.playbackRate = speed;
                audio.currentTime = Math.max(0, expectedLocalTime);
                audio.play().catch(() => {});
                activeAudios.set(block.id, audio);
            } else {
                if (audio.paused && audio.readyState >= 3) audio.play();
                if (Math.abs(audio.playbackRate - speed) > 0.01) audio.playbackRate = speed;
                if (audio.readyState >= 2) { 
                    const diff = audio.currentTime - expectedLocalTime;
                    if (Math.abs(diff) > 0.2) audio.currentTime = expectedLocalTime;
                }
            }
        } else if (activeAudios.has(block.id)) {
             activeAudios.get(block.id)?.pause();
             activeAudios.delete(block.id);
        }
    });
    animationFrameId = requestAnimationFrame(tick);
};

const seek = (time: number) => {
    store.seek(Math.max(0, Math.min(time, timelineDuration.value)));
};

// Drag & Drop
const handleBlockMouseDown = (e: MouseEvent, blockId: string) => {
    e.stopPropagation();
    store.toggleSelection(blockId, false);
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
        store.sortBlocksByTime();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
};

// End marker drag
const handleDurationDrag = (e: MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const initialDuration = store.projectDuration;
    const onMove = (ev: MouseEvent) => {
        const deltaPx = ev.clientX - startX;
        const deltaSec = deltaPx / PX_PER_SEC.value;
        store.userDuration = Math.round(Math.max(0, initialDuration + deltaSec) * 10) / 10;
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
  <div class="h-[calc(100vh-4rem)] flex flex-col bg-background overflow-hidden">
    <ResizablePanelGroup direction="vertical" class="flex-1">
      <ResizablePanel :default-size="70" :min-size="40">
        <ResizablePanelGroup direction="horizontal">
          <!-- Script Panel -->
          <ResizablePanel 
            :default-size="45" 
            :min-size="0" 
            :collapsible="true"
            @collapse="isSidebarCollapsed = true"
            @expand="isSidebarCollapsed = false"
            class="relative group/lnb"
          >
            <!-- Toggle Button (Inside Panel when open) -->
            <Button 
                v-if="!isSidebarCollapsed"
                variant="ghost" 
                size="icon" 
                class="absolute -right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full z-50 bg-background shadow-md border border-border hover:bg-accent hover:text-primary transition-all opacity-0 group-hover/lnb:opacity-100"
                @click="isSidebarCollapsed = true"
            >
                <ChevronLeft class="h-4 w-4" />
            </Button>

            <div class="h-full flex flex-col border-r bg-muted/20">
              <div class="flex items-center justify-between px-6 h-14 border-b bg-background/50 backdrop-blur-sm shrink-0">
                <div class="flex items-center gap-3">
                  <div class="p-1.5 bg-primary/10 rounded-lg">
                    <Terminal class="h-4 w-4 text-primary" />
                  </div>
                  <h3 class="text-xs font-black uppercase tracking-[0.2em] text-foreground/70">Script Editor</h3>
                </div>
                <Button variant="outline" size="sm" @click.stop="store.addBlock()" class="h-9 px-3 text-xs font-bold rounded-lg border-primary/20 hover:bg-primary/5 hover:text-primary transition-all">
                  <Plus class="h-3.5 w-3.5 mr-2" /> Add Script Block
                </Button>
              </div>
              
              <ScrollArea class="flex-1 bg-background/30" @click="store.toggleSelection('', false)">
                <div class="p-6 md:p-8 space-y-6">
                  <div v-for="(block, index) in store.blocks" :key="block.id" class="relative group">
                    <ScriptBlock :blockId="block.id" :voices="voices" />
                    <!-- Insert divider -->
                    <div 
                      class="absolute -bottom-3 left-0 right-0 h-6 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      @click.stop="store.addBlock(index + 1)"
                    >
                      <div class="w-full h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
                      <div class="absolute bg-primary text-primary-foreground rounded-full p-1 shadow-lg shadow-primary/20 scale-90 group-hover:scale-100 transition-transform">
                        <Plus class="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                  <div 
                    class="border-2 border-dashed border-muted rounded-2xl p-12 flex flex-col items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group shadow-inner"
                    @click.stop="store.addBlock()"
                  >
                    <div class="p-4 bg-muted/50 rounded-2xl group-hover:scale-110 transition-transform mb-4">
                      <Plus class="h-8 w-8" />
                    </div>
                    <span class="text-sm font-bold uppercase tracking-widest">New Script Track</span>
                  </div>
                </div>
              </ScrollArea>

              <div class="h-20 px-6 border-t bg-background/50 backdrop-blur-md flex items-center shrink-0">
                <Button class="w-full h-12 shadow-xl shadow-primary/20 rounded-xl font-bold text-base transition-all hover:scale-[1.01] active:scale-[0.99]" @click.stop="store.generateBatch">
                  <Layers class="h-5 w-5 mr-3" />
                  {{ store.selectedBlocks.length > 0 ? `Generate Selected Tracks (${store.selectedBlocks.length})` : 'Generate Full Audio Project' }}
                </Button>
              </div>
            </div>
          </ResizablePanel>
          
          <ResizableHandle with-handle class="w-1 bg-border/50 hover:bg-primary/50 transition-colors">
            <!-- Toggle Button (When closed) -->
            <Button 
                v-if="isSidebarCollapsed"
                variant="outline" 
                size="icon" 
                class="absolute -left-4 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full z-50 bg-background shadow-md border hover:bg-accent hover:text-primary transition-all"
                @click="isSidebarCollapsed = false"
            >
                <ChevronRight class="h-4 w-4" />
            </Button>
          </ResizableHandle>

          <!-- Monitor Panel -->
          <ResizablePanel :default-size="isSidebarCollapsed ? 100 : 55">
            <div class="h-full flex flex-col bg-zinc-950">
              <div class="flex items-center justify-between px-6 h-14 border-b border-white/5 bg-white/5 shrink-0">
                <div class="flex items-center gap-3">
                  <div class="p-1.5 bg-white/10 rounded-lg text-white/50">
                    <MonitorIcon class="h-4 w-4" />
                  </div>
                  <h3 class="text-xs font-black uppercase tracking-[0.2em] text-white/50">Project Monitor</h3>
                </div>
                <div class="flex items-center gap-4">
                  <div class="flex items-center gap-2 px-3 py-1 rounded-lg bg-black border border-white/10 text-[12px] font-mono tabular-nums shadow-inner">
                    <span class="text-primary font-black">{{ currentTime.toFixed(2) }}s</span>
                    <span class="text-white/20">/</span>
                    <span class="text-white/40">{{ store.projectDuration.toFixed(2) }}s</span>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          class="h-9 w-9 text-white/50 hover:text-white hover:bg-white/10 rounded-lg border border-white/5"
                          @click="handleExport" 
                          :disabled="isExporting || store.blocks.length === 0"
                        >
                          <Loader2 v-if="isExporting" class="h-4 w-4 animate-spin" />
                          <Download v-else class="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent class="bg-zinc-900 text-white border-zinc-800">Export High-Res Master</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <div class="flex-1 relative flex items-center justify-center overflow-hidden">
                <div class="absolute inset-0 opacity-10 pointer-events-none" style="background-image: radial-gradient(circle at center, #fff 1px, transparent 1px); background-size: 32px 32px;"></div>
                
                <div class="z-10 text-center space-y-6">
                  <div v-if="isPlaying" class="flex items-end justify-center gap-1.5 h-16">
                     <div v-for="i in 16" :key="i" class="w-1.5 bg-primary/80 rounded-full animate-waveform shadow-[0_0_15px_rgba(var(--primary),0.5)]" :style="{ height: `${20 + Math.random() * 60}px`, animationDelay: `${i * 0.05}s` }"></div>
                  </div>
                  <div class="space-y-2">
                    <h2 class="text-4xl font-black tracking-tighter text-white uppercase italic">
                      {{ isPlaying ? 'Playing' : 'Ready' }}
                    </h2>
                    <p class="text-xs text-white/40 font-mono tracking-[0.5em] uppercase">{{ currentTime.toFixed(3) }}</p>
                  </div>
                </div>

                <!-- Subtitles / Active block text preview -->
                <div class="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 transition-all duration-300 transform" :class="activeAudios.size > 0 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'">
                   <div class="bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl text-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
                     <p class="text-white/90 text-xl font-medium leading-relaxed italic font-display">
                        "{{ store.blocks.find(b => activeAudios.has(b.id))?.text }}"
                     </p>
                   </div>
                </div>
              </div>

              <div class="h-20 border-t border-white/5 flex items-center justify-center gap-10 bg-white/5 shrink-0">
                <Button variant="ghost" size="icon" @click="seek(0)" class="h-12 w-12 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                  <Rewind class="h-6 w-6 fill-current" />
                </Button>
                <Button variant="default" size="icon" @click="togglePlayback" class="h-14 w-14 rounded-2xl shadow-2xl shadow-primary/40 transform transition-all hover:scale-110 active:scale-95 bg-primary text-primary-foreground">
                  <Pause v-if="isPlaying" class="h-8 w-8 fill-current" />
                  <Play v-else class="h-8 w-8 fill-current ml-1" />
                </Button>
                <Button variant="ghost" size="icon" @click="seek(timelineDuration)" class="h-12 w-12 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                  <SkipForward class="h-6 w-6 fill-current" />
                </Button>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>

      <ResizableHandle with-handle class="h-1.5 bg-border/50 hover:bg-primary/50 transition-colors" />

      <!-- Timeline Panel -->
      <ResizablePanel :default-size="30" :min-size="15">
        <div class="h-full flex flex-col bg-background">
          <div class="flex items-center justify-between px-6 h-12 border-b bg-muted/30">
            <div class="flex items-center gap-3">
              <div class="p-1 px-2 bg-muted rounded font-mono text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                <Clock class="h-3 w-3" />
                Timeline
              </div>
            </div>
            <div class="flex items-center gap-4">
              <div class="flex items-center p-0.5 rounded-lg bg-muted/50 border shadow-inner overflow-hidden">
                <Button variant="ghost" size="icon" class="h-7 w-7 rounded-md p-0 hover:bg-background shadow-xs transition-all" @click="PX_PER_SEC = Math.max(10, PX_PER_SEC - 10)">
                  <ZoomOut class="h-3.5 w-3.5" />
                </Button>
                <div class="px-3 text-[10px] font-black font-mono tracking-widest text-muted-foreground/60">{{ PX_PER_SEC }}PX/S</div>
                <Button variant="ghost" size="icon" class="h-7 w-7 rounded-md p-0 hover:bg-background shadow-xs transition-all" @click="PX_PER_SEC += 10">
                  <ZoomIn class="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
          
          <div class="flex-1 relative overflow-auto scrollbar-hide bg-muted/5">
            <!-- Ruler -->
            <div class="sticky top-0 z-30 flex border-b bg-background/90 backdrop-blur-md">
              <div class="w-40 shrink-0 border-r bg-muted/20"></div>
              <div class="flex-1 relative h-10 select-none cursor-crosshair" :style="{ width: (timelineDuration * PX_PER_SEC) + 'px' }" @mousedown="(e: any) => seek(e.offsetX / PX_PER_SEC)">
                <div v-for="i in Math.floor(timelineDuration) + 1" :key="i" class="absolute top-0 bottom-0 border-l border-muted/50 transition-opacity" :class="{'opacity-100': (i-1)%5===0, 'opacity-40': (i-1)%5!==0}" :style="{ left: ((i-1) * PX_PER_SEC) + 'px' }">
                  <span v-if="(i-1) % 5 === 0" class="absolute top-2 left-2 text-[10px] font-black font-mono text-muted-foreground tracking-tighter underline decoration-primary/40 underline-offset-4">{{ i-1 }}s</span>
                  <div v-else class="h-2 w-px bg-muted-foreground/20 mt-auto"></div>
                </div>
                
                <!-- Playhead (Top Marker) -->
                <div class="absolute inset-y-0 w-0.5 bg-primary z-50 pointer-events-none shadow-[0_0_10px_rgba(var(--primary),0.5)]" :style="{ left: (currentTime * PX_PER_SEC) + 'px' }">
                  <div class="absolute -top-1 -left-[6px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-primary shadow-xl"></div>
                </div>
              </div>
            </div>

            <div class="flex flex-col min-h-full">
              <div class="flex flex-1 min-h-[200px]">
                <div class="w-40 shrink-0 border-r bg-muted/10 flex flex-col py-4">
                  <div class="px-4 py-2 flex items-center gap-3 group hover:bg-primary/5 transition-colors cursor-default rounded-r-lg">
                    <div class="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)]"></div>
                    <span class="text-[11px] font-black uppercase tracking-widest text-foreground/70">Voice Track</span>
                  </div>
                </div>
                
                <div class="flex-1 relative min-h-full py-4 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)]" :style="{ width: (timelineDuration * PX_PER_SEC) + 'px' }">
                  <!-- Global playhead line -->
                  <div class="absolute inset-y-0 w-px bg-primary/40 z-20 pointer-events-none shadow-[0_0_15px_rgba(var(--primary),0.3)]" :style="{ left: (currentTime * PX_PER_SEC) + 'px' }"></div>

                  <!-- Clips Container -->
                  <div class="relative h-32">
                    <div 
                      v-for="block in store.blocks" 
                      :key="block.id"
                      class="absolute top-4 h-20 rounded-xl border-2 transition-all cursor-move flex flex-col overflow-hidden shadow-xl group/clip"
                      :class="{ 
                        'border-primary bg-primary/20 shadow-primary/10 ring-4 ring-primary/10 z-10': block.selected,
                        'border-border bg-card/80 hover:border-primary/40 hover:bg-card/90': !block.selected,
                        'opacity-40 grayscale': !block.audioUrl
                      }"
                      :style="{
                        left: (block.timelineStart * PX_PER_SEC) + 'px',
                        width: Math.max(20, ((block.endTime - block.startTime) / block.speed) * PX_PER_SEC) + 'px'
                      }"
                      @mousedown="(e) => handleBlockMouseDown(e, block.id)"
                    >
                      <div class="px-3 py-1.5 bg-muted/40 text-[10px] font-black uppercase tracking-widest truncate border-b border-muted/50 group-hover/clip:bg-primary/10 transition-colors flex items-center gap-2">
                        <div class="w-1.5 h-1.5 rounded-full bg-primary/60"></div>
                        {{ block.voice || 'Loading...' }}
                      </div>
                      <div class="flex-1 p-2 flex items-center gap-1 overflow-hidden relative">
                        <!-- Waveform visualization -->
                        <div v-if="block.audioUrl" class="w-full h-full flex items-center gap-[2px] opacity-40">
                           <div v-for="i in 30" :key="i" class="flex-1 bg-primary/60 rounded-full" :style="{ height: `${15 + Math.random() * 70}%` }"></div>
                        </div>
                        <div v-else class="absolute inset-0 flex items-center justify-center bg-muted/20">
                          <Loader2 class="h-4 w-4 animate-spin text-muted-foreground/40" />
                        </div>
                      </div>
                      
                      <!-- Clip Handles (Visual Only for now) -->
                      <div class="absolute inset-y-0 left-0 w-1.5 bg-primary/10 hover:bg-primary/40 cursor-ew-resize transition-colors"></div>
                      <div class="absolute inset-y-0 right-0 w-1.5 bg-primary/10 hover:bg-primary/40 cursor-ew-resize transition-colors"></div>
                    </div>
                  </div>

                  <!-- Project End Marker -->
                  <div 
                    class="absolute inset-y-0 w-4 group cursor-ew-resize z-40 transition-all flex justify-center" 
                    :style="{ left: (store.projectDuration * PX_PER_SEC) + 'px' }"
                    @mousedown="handleDurationDrag"
                  >
                    <div class="absolute top-0 -translate-y-1/2 bg-amber-500 text-black font-black text-[9px] px-2 py-0.5 rounded shadow-xl tracking-tighter">END</div>
                    <div class="h-full w-0.5 bg-amber-500/60 group-hover:bg-amber-500 transition-colors shadow-[0_0_15px_rgba(var(--amber-500),0.3)]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>

<style>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
