<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import { Mic, Edit3, Settings } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/components/ThemeToggle.vue';
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-sans antialiased">
    <header class="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div class="flex h-16 items-center gap-6 px-6 md:px-10">
        <div class="flex items-center gap-10">
          <RouterLink to="/" class="flex items-center space-x-3 group">
            <div class="h-9 w-9 bg-primary rounded-xl flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-105 group-active:scale-95">
              <Mic class="h-5 w-5 text-primary-foreground" />
            </div>
            <span class="font-display font-extrabold text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">Qwen3 Studio</span>
          </RouterLink>
          <nav class="flex items-center space-x-1 text-sm font-medium">
            <RouterLink 
              to="/voice-clone" 
              class="px-4 py-2 rounded-lg transition-all hover:bg-accent hover:text-accent-foreground flex items-center gap-2.5 group"
              active-class="bg-accent text-accent-foreground font-bold shadow-sm"
            >
              <Mic class="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span>Voice Library</span>
            </RouterLink>
            <RouterLink 
              to="/editor" 
              class="px-4 py-2 rounded-lg transition-all hover:bg-accent hover:text-accent-foreground flex items-center gap-2.5 group"
              active-class="bg-accent text-accent-foreground font-bold shadow-sm"
            >
              <Edit3 class="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span>Studio Editor</span>
            </RouterLink>
          </nav>
        </div>
        <div class="flex flex-1 items-center justify-end space-x-4">
          <nav class="flex items-center gap-3">
            <Button variant="ghost" size="icon" class="h-10 w-10 text-muted-foreground hover:bg-accent hover:text-foreground transition-all rounded-full">
              <Settings class="h-5 w-5" />
            </Button>
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>

<style>
/* Global reset or tweaks if needed, but Tailwind should handle most */
html, body {
  height: 100%;
  margin: 0;
}

#app {
  height: 100%;
}

.text-foreground\/60 {
  color: hsl(var(--foreground) / 0.6);
}
</style>
