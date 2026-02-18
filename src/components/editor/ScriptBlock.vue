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
    class="rounded-lg border bg-card text-card-foreground shadow-sm mb-4 transition-all"
    :class="{ 
      'ring-1 ring-primary border-primary/50 shadow-md': block.selected, 
      'bg-primary/5': isPlaying 
    }"
    @click="store.toggleSelection(block.id, false)"
  >
    <div class="p-3 flex items-center gap-3 border-b border-muted/50">
      <Checkbox 
        :checked="block.selected" 
        @update:checked="store.toggleSelection(block.id, true)"
        @click.stop
      />
      
      <div class="flex items-center gap-2 flex-1">
        <Select v-model="block.voice">
          <SelectTrigger class="w-[140px] h-8 text-xs bg-muted/30">
            <SelectValue placeholder="Select Voice" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="v in voices" :key="v" :value="v">{{ v }}</SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="block.language">
          <SelectTrigger class="w-[100px] h-8 text-xs bg-muted/30">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="l in languages" :key="l.value" :value="l.value">{{ l.label }}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="flex items-center gap-2">
        <Badge v-if="block.status === 'done'" variant="secondary" class="h-5 text-[10px]">Generated</Badge>
        <Badge v-if="block.status === 'error'" variant="destructive" class="h-5 text-[10px]">Error</Badge>
        <Button 
          variant="ghost" 
          size="icon" 
          class="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          @click.stop="store.removeBlock(block.id)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
    
    <div class="p-4 relative">
      <Textarea 
        v-model="block.text" 
        placeholder="Type here..."
        class="min-h-[80px] border-none bg-transparent p-0 focus-visible:ring-0 resize-none text-base leading-relaxed"
        @click.stop="store.toggleSelection(block.id, false)"
      />
      
      <div class="mt-4 flex items-center gap-3" v-if="block.audioUrl">
        <Button 
          variant="secondary" 
          size="icon" 
          class="h-8 w-8 rounded-full shadow-sm"
          @click.stop="togglePlay"
        >
          <Pause v-if="isPlaying" class="h-4 w-4 fill-current" />
          <Play v-else class="h-4 w-4 fill-current" />
        </Button>
        <div class="flex-1 h-1.5 bg-muted rounded-full relative overflow-hidden">
           <div 
             class="absolute inset-y-0 bg-primary/40 rounded-full"
             :style="{
               left: (block.startTime / block.duration * 100) + '%',
               width: ((block.endTime - block.startTime) / block.duration * 100) + '%'
             }"
           ></div>
           
           <div v-if="isPlaying" class="absolute inset-y-0 w-0.5 bg-primary z-10" :style="{
               left: (( ((store.currentTime - block.timelineStart)*block.speed + block.startTime) / block.duration ) * 100) + '%'
           }"></div>
        </div>
        <div class="text-[10px] font-mono text-muted-foreground tabular-nums">
           {{ block.startTime.toFixed(1) }}s - {{ block.endTime.toFixed(1) }}s
        </div>
      </div>
      
      <div v-if="block.status === 'loading'" class="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center z-20 rounded-b-lg">
         <div class="flex items-center gap-2 px-3 py-1.5 bg-background border rounded-full shadow-sm">
           <Loader2 class="h-3.5 w-3.5 animate-spin text-primary" />
           <span class="text-xs font-medium">Generating...</span>
         </div>
      </div>
    </div>
  </div>
</template>
