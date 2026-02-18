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
    Clock
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
  <div class="h-[calc(100vh-3.5rem)] flex flex-col bg-background overflow-hidden">
    <ResizablePanelGroup direction="vertical" class="flex-1">
      <ResizablePanel :default-size="70" :min-size="40">
        <ResizablePanelGroup direction="horizontal">
          <!-- Script Panel -->
          <ResizablePanel :default-size="40" :min-size="30">
            <div class="h-full flex flex-col border-r">
              <div class="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
                <div class="flex items-center gap-2">
                  <Terminal class="h-4 w-4 text-muted-foreground" />
                  <h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Script Editor</h3>
                </div>
                <Button variant="ghost" size="xs" @click.stop="store.addBlock()" class="h-7 px-2 text-xs">
                  <Plus class="h-3 w-3 mr-1" /> Add Block
                </Button>
              </div>
              
              <ScrollArea class="flex-1" @click="store.toggleSelection('', false)">
                <div class="p-6 space-y-4">
                  <div v-for="(block, index) in store.blocks" :key="block.id" class="relative group">
                    <ScriptBlock :blockId="block.id" :voices="voices" />
                    <!-- Insert divider -->
                    <div 
                      class="absolute -bottom-2 left-0 right-0 h-4 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      @click.stop="store.addBlock(index + 1)"
                    >
                      <div class="w-full h-[1px] bg-primary/40"></div>
                      <div class="absolute bg-primary text-primary-foreground rounded-full p-0.5">
                        <Plus class="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                  <div 
                    class="border-2 border-dashed border-muted rounded-lg p-8 flex flex-col items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
                    @click.stop="store.addBlock()"
                  >
                    <Plus class="h-6 w-6 mb-2" />
                    <span class="text-sm font-medium">New Script Block</span>
                  </div>
                </div>
              </ScrollArea>

              <div class="p-4 border-t bg-muted/20">
                <Button class="w-full shadow-md" @click.stop="store.generateBatch">
                  <Layers class="h-4 w-4 mr-2" />
                  {{ store.selectedBlocks.length > 0 ? `Generate Selected (${store.selectedBlocks.length})` : 'Generate All Tracks' }}
                </Button>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle with-handle />

          <!-- Monitor Panel -->
          <ResizablePanel :default-size="60">
            <div class="h-full flex flex-col">
              <div class="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
                <div class="flex items-center gap-2">
                  <MonitorIcon class="h-4 w-4 text-muted-foreground" />
                  <h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monitor</h3>
                </div>
                <div class="flex items-center gap-3">
                  <div class="flex items-center gap-1.5 px-2 py-0.5 rounded bg-background border text-[11px] font-mono tabular-nums">
                    <span class="text-primary font-bold">{{ currentTime.toFixed(2) }}s</span>
                    <span class="text-muted-foreground">/</span>
                    <span class="text-muted-foreground">{{ store.projectDuration.toFixed(2) }}s</span>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          class="h-7 w-7"
                          @click="handleExport" 
                          :disabled="isExporting || store.blocks.length === 0"
                        >
                          <Loader2 v-if="isExporting" class="h-3.5 w-3.5 animate-spin" />
                          <Download v-else class="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Export Project</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <div class="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
                <div class="absolute inset-0 opacity-20 pointer-events-none" style="background-image: radial-gradient(circle at center, #222 1px, transparent 1px); background-size: 20px 20px;"></div>
                
                <div class="z-10 text-center space-y-4">
                  <div v-if="isPlaying" class="flex items-center justify-center gap-1 h-12">
                     <div v-for="i in 12" :key="i" class="w-1 bg-primary rounded-full animate-pulse" :style="{ height: `${10 + Math.random() * 30}px`, animationDelay: `${i * 0.1}s` }"></div>
                  </div>
                  <h2 class="text-3xl font-bold tracking-tighter text-white/90">
                    {{ isPlaying ? 'PLAYING' : 'READY' }}
                  </h2>
                  <p class="text-sm text-muted-foreground font-mono">{{ currentTime.toFixed(3) }}</p>
                </div>

                <!-- Active block text preview -->
                <div class="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-4">
                   <div v-if="activeAudios.size > 0" class="bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-lg text-center shadow-2xl">
                     <p class="text-white/80 text-lg leading-relaxed italic">
                        "{{ store.blocks.find(b => activeAudios.has(b.id))?.text }}"
                     </p>
                   </div>
                </div>
              </div>

              <div class="h-16 border-t flex items-center justify-center gap-8 bg-muted/20">
                <Button variant="ghost" size="icon" @click="seek(0)" class="h-10 w-10 text-muted-foreground hover:text-foreground">
                  <Rewind class="h-5 w-5 fill-current" />
                </Button>
                <Button variant="default" size="icon" @click="togglePlayback" class="h-12 w-12 rounded-full shadow-lg scale-110">
                  <Pause v-if="isPlaying" class="h-6 w-6 fill-current" />
                  <Play v-else class="h-6 w-6 fill-current ml-1" />
                </Button>
                <Button variant="ghost" size="icon" @click="seek(timelineDuration)" class="h-10 w-10 text-muted-foreground hover:text-foreground">
                  <SkipForward class="h-5 w-5 fill-current" />
                </Button>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>

      <ResizableHandle with-handle />

      <!-- Timeline Panel -->
      <ResizablePanel :default-size="30" :min-size="15">
        <div class="h-full flex flex-col bg-muted/10">
          <div class="flex items-center justify-between px-4 py-1.5 border-b bg-muted/40">
            <div class="flex items-center gap-2">
              <Clock class="h-4 w-4 text-muted-foreground" />
              <h3 class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Timeline</h3>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex items-center border rounded bg-background overflow-hidden">
                <Button variant="ghost" size="icon" class="h-6 w-6 rounded-none p-0" @click="PX_PER_SEC = Math.max(10, PX_PER_SEC - 10)">
                  <ZoomOut class="h-3 w-3" />
                </Button>
                <Separator orientation="vertical" class="h-4" />
                <span class="px-2 text-[10px] font-mono font-bold">{{ PX_PER_SEC }}px/s</span>
                <Separator orientation="vertical" class="h-4" />
                <Button variant="ghost" size="icon" class="h-6 w-6 rounded-none p-0" @click="PX_PER_SEC += 10">
                  <ZoomIn class="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
          
          <div class="flex-1 relative overflow-auto scrollbar-hide">
            <!-- Ruler -->
            <div class="sticky top-0 z-30 flex border-b bg-background/80 backdrop-blur">
              <div class="w-32 shrink-0 border-r bg-muted/50"></div>
              <div class="flex-1 relative h-8" :style="{ width: (timelineDuration * PX_PER_SEC) + 'px' }" @click="(e: any) => seek(e.offsetX / PX_PER_SEC)">
                <div v-for="i in Math.floor(timelineDuration) + 1" :key="i" class="absolute top-0 bottom-0 border-l border-muted/50" :style="{ left: ((i-1) * PX_PER_SEC) + 'px' }">
                  <span v-if="(i-1) % 5 === 0" class="absolute top-1 left-2 text-[10px] font-mono font-bold text-muted-foreground/60">{{ i-1 }}s</span>
                </div>
                
                <!-- Playhead (Top Part) -->
                <div class="absolute inset-y-0 w-0.5 bg-primary z-50 pointer-events-none" :style="{ left: (currentTime * PX_PER_SEC) + 'px' }">
                  <div class="absolute -top-1 -left-[5px] w-3 h-3 bg-primary rounded-full shadow-lg"></div>
                </div>
              </div>
            </div>

            <div class="flex flex-col">
              <div class="flex min-h-[160px]">
                <div class="w-32 shrink-0 border-r bg-muted/20 flex flex-col py-2">
                  <div class="px-3 py-1 flex items-center gap-2 group hover:bg-muted/40 transition-colors cursor-default">
                    <div class="w-2 h-2 rounded-full bg-primary/60"></div>
                    <span class="text-[11px] font-semibold text-muted-foreground/80">Voice Track</span>
                  </div>
                </div>
                
                <div class="flex-1 relative min-h-full py-2 bg-grid-slate-900/[0.04]" :style="{ width: (timelineDuration * PX_PER_SEC) + 'px' }">
                  <!-- Global playhead line -->
                  <div class="absolute inset-y-0 w-[1px] bg-primary/40 z-20 pointer-events-none" :style="{ left: (currentTime * PX_PER_SEC) + 'px' }"></div>

                  <!-- Clips -->
                  <div class="relative h-24">
                    <div 
                      v-for="block in store.blocks" 
                      :key="block.id"
                      class="absolute top-2 h-14 rounded-md border-2 transition-shadow cursor-move flex flex-col overflow-hidden shadow-sm"
                      :class="{ 
                        'border-primary bg-primary/10 shadow-lg ring-2 ring-primary/20 z-10': block.selected,
                        'border-muted-foreground/40 bg-card/60': !block.selected,
                        'opacity-50 grayscale': !block.audioUrl
                      }"
                      :style="{
                        left: (block.timelineStart * PX_PER_SEC) + 'px',
                        width: Math.max(10, ((block.endTime - block.startTime) / block.speed) * PX_PER_SEC) + 'px'
                      }"
                      @mousedown="(e) => handleBlockMouseDown(e, block.id)"
                    >
                      <div class="px-2 py-1 bg-muted/40 text-[10px] font-bold truncate border-b border-muted/50 group-hover:bg-muted transition-colors">
                        {{ block.voice || 'Unknown' }}
                      </div>
                      <div class="flex-1 p-1 flex items-center gap-1 overflow-hidden">
                        <div v-if="block.audioUrl" class="w-full flex items-end gap-[1px] h-full opacity-60">
                           <div v-for="i in 20" :key="i" class="flex-1 bg-primary/80" :style="{ height: `${20 + Math.random() * 80}%` }"></div>
                        </div>
                        <p v-else class="text-[9px] text-muted-foreground italic px-1">Generating...</p>
                      </div>
                    </div>
                  </div>

                  <!-- Project End Marker -->
                  <div 
                    class="absolute inset-y-0 w-2 group cursor-ew-resize z-40 transition-colors hover:bg-primary/20" 
                    :style="{ left: (store.projectDuration * PX_PER_SEC) + 'px' }"
                    @mousedown="handleDurationDrag"
                  >
                    <div class="absolute top-0 -translate-x-1/2 bg-yellow-500 text-black font-bold text-[9px] px-1 rounded shadow-md">END</div>
                    <div class="h-full w-[1px] bg-yellow-500/60 shadow-lg ml-[0.5px]"></div>
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
