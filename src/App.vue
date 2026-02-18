<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import { Mic, Edit3, Settings } from 'lucide-vue-next';
import ThemeToggle from '@/components/ThemeToggle.vue';
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-sans antialiased">
    <header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="container flex h-14 items-center gap-4 px-4 md:px-8">
        <div class="mr-4 flex">
          <RouterLink to="/" class="mr-6 flex items-center space-x-2">
            <span class="font-bold inline-block text-xl tracking-tight">Qwen3 Studio</span>
          </RouterLink>
          <nav class="flex items-center space-x-6 text-sm font-medium">
            <RouterLink 
              to="/voice-clone" 
              class="transition-colors hover:text-foreground/80 flex items-center gap-2"
              active-class="text-foreground font-semibold"
              class-inactive="text-foreground/60"
            >
              <Mic class="h-4 w-4" />
              <span>Clone</span>
            </RouterLink>
            <RouterLink 
              to="/editor" 
              class="transition-colors hover:text-foreground/80 flex items-center gap-2"
              active-class="text-foreground font-semibold"
              class-inactive="text-foreground/60"
            >
              <Edit3 class="h-4 w-4" />
              <span>Editor</span>
            </RouterLink>
          </nav>
        </div>
        <div class="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div class="w-full flex-1 md:w-auto md:flex-none">
          </div>
          <nav class="flex items-center gap-2">
            <div class="nav-icon p-2 hover:bg-accent rounded-md transition-colors cursor-pointer">
              <Settings class="h-4 w-4 text-muted-foreground" />
            </div>
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
