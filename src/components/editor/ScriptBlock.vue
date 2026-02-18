<script setup lang="ts">
import { computed } from 'vue';
import { useStudioStore } from '../../stores/studio';
import { Play, Pause, Trash2, Loader2 } from 'lucide-vue-next';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const props = defineProps<{
  blockId: string;
  voices: string[];
}>();

const store = useStudioStore();
const block = computed(() => store.blocks.find(b => b.id === props.blockId));

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
      store.seek(block.value.timelineStart);
      store.isPlaying = true;
  }
};

const languages = [
  { label: 'Auto', value: 'auto' },
  { label: 'Korean', value: 'korean' },
  { label: 'English', value: 'english' },
  { label: 'Japanese', value: 'japanese' },
  { label: 'Chinese', value: 'chinese' },
  { label: 'French', value: 'french' },
  { label: 'German', value: 'german' },
  { label: 'Italian', value: 'italian' },
  { label: 'Portuguese', value: 'portuguese' },
  { label: 'Russian', value: 'russian' },
  { label: 'Spanish', value: 'spanish' },
];

</script>

<template>
  <div 
    v-if="block"
    class="rounded-2xl border bg-card text-card-foreground shadow-sm mb-6 transition-all duration-300"
    :class="{ 
      'ring-2 ring-primary border-primary/20 shadow-xl shadow-primary/10 translate-x-1': block.selected, 
      'bg-primary/5': isPlaying,
      'hover:shadow-md hover:border-border/60': !block.selected
    }"
    @click="store.toggleSelection(block.id, false)"
  >
    <div class="px-5 py-4 flex items-center gap-4 border-b border-muted/50 bg-muted/10">
      <Checkbox 
        :checked="block.selected" 
        @update:checked="store.toggleSelection(block.id, true)"
        @click.stop
        class="h-5 w-5 rounded-md border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all"
      />
      
      <div class="flex items-center gap-3 flex-1">
        <Select v-model="block.voice">
          <SelectTrigger class="w-[160px] h-10 text-xs bg-background border-muted-foreground/10 focus:ring-primary/20 font-bold uppercase tracking-wider rounded-xl">
            <SelectValue placeholder="Voice" />
          </SelectTrigger>
          <SelectContent class="rounded-xl border-muted">
            <SelectItem v-for="v in voices" :key="v" :value="v" class="rounded-lg py-2.5 font-medium tracking-tight">{{ v }}</SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="block.language">
          <SelectTrigger class="w-[120px] h-10 text-xs bg-background border-muted-foreground/10 focus:ring-primary/20 font-bold uppercase tracking-wider rounded-xl">
            <SelectValue placeholder="Lang" />
          </SelectTrigger>
          <SelectContent class="rounded-xl border-muted">
            <SelectItem v-for="l in languages" :key="l.value" :value="l.value" class="rounded-lg py-2.5 font-medium tracking-tight">{{ l.label }}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="flex items-center gap-3">
        <Badge v-if="block.status === 'done'" variant="secondary" class="h-6 text-[9px] font-black uppercase tracking-widest bg-green-500/10 text-green-600 border-green-500/20 shadow-sm">Ready</Badge>
        <Badge v-if="block.status === 'error'" variant="destructive" class="h-6 text-[9px] font-black uppercase tracking-widest shadow-sm">Failed</Badge>
        
        <div class="w-px h-6 bg-muted/80"></div>

        <Button 
          variant="ghost" 
          size="icon" 
          class="h-9 w-9 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
          @click.stop="store.removeBlock(block.id)"
        >
          <Trash2 class="h-4 w-4" />
        </Button>
      </div>
    </div>
    
    <div class="p-6 relative">
      <Textarea 
        v-model="block.text" 
        placeholder="Enter script text here..."
        class="min-h-[140px] border-none bg-muted/20 px-6 py-5 focus-visible:ring-2 focus-visible:ring-primary/10 resize-none text-lg leading-relaxed rounded-xl transition-all hover:bg-muted/30 font-display font-medium shadow-inner"
        @click.stop="store.toggleSelection(block.id, false)"
      />
      
      <div class="mt-6 flex items-center gap-4" v-if="block.audioUrl">
        <Button 
          variant="secondary" 
          size="icon" 
          class="h-10 w-10 rounded-xl shadow-md bg-background hover:bg-muted border border-border/40 text-primary transition-all active:scale-95 flex items-center justify-center p-0"
          @click.stop="togglePlay"
        >
          <Pause v-if="isPlaying" class="h-5 w-5 fill-current" />
          <Play v-else class="h-5 w-5 fill-current" />
        </Button>
        <div class="flex-1 h-2 bg-muted/50 rounded-full relative overflow-hidden shadow-inner border border-muted">
           <div 
             class="absolute inset-y-0 bg-primary/30 rounded-full"
             :style="{
               left: (block.startTime / block.duration * 100) + '%',
               width: ((block.endTime - block.startTime) / block.duration * 100) + '%'
             }"
           ></div>
           
           <div v-if="isPlaying" class="absolute inset-y-0 w-1 bg-primary z-10 shadow-[0_0_8px_rgba(var(--primary),0.6)]" :style="{
               left: (( ((store.currentTime - block.timelineStart)*block.speed + block.startTime) / block.duration ) * 100) + '%'
           }"></div>
        </div>
        <div class="text-[11px] font-black font-mono text-muted-foreground tabular-nums tracking-tighter bg-muted/20 px-2 py-1 rounded shadow-sm">
           {{ block.startTime.toFixed(2) }}s <span class="text-muted-foreground/30 mx-1">/</span> {{ block.endTime.toFixed(2) }}s
        </div>
      </div>
      
      <div v-if="block.status === 'loading'" class="absolute inset-0 bg-background/40 backdrop-blur-md flex items-center justify-center z-20 rounded-b-2xl transition-all">
         <div class="flex items-center gap-3 px-5 py-3 bg-background border border-primary/20 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
           <Loader2 class="h-5 w-5 animate-spin text-primary" />
           <span class="text-sm font-bold uppercase tracking-widest text-foreground/80">Synthesizing...</span>
         </div>
      </div>
    </div>
  </div>
</template>
