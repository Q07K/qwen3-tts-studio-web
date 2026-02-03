<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import { Mic, Edit3, Settings } from 'lucide-vue-next';
</script>

<template>
  <div class="app-layout">
    <header class="header glass-panel">
      <div class="logo">
        <h2>Qwen3 Studio</h2>
      </div>
      <nav class="nav-menu">
        <RouterLink to="/voice-clone" class="nav-item" active-class="active">
          <Mic :size="18" />
          <span>Clone</span>
        </RouterLink>
        <RouterLink to="/editor" class="nav-item" active-class="active">
          <Edit3 :size="18" />
          <span>Editor</span>
        </RouterLink>
      </nav>
      <div class="right-actions">
        <div class="nav-icon">
          <Settings :size="18" />
        </div>
      </div>
    </header>
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  gap: 0;
  overflow: hidden;
  background: black;
}

.header {
  height: 48px;
  width: 100%;
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
  border-bottom: 1px solid var(--col-border);
  flex-shrink: 0;
  z-index: 100;
  justify-content: flex-start; /* Logo left */
  background: #050505;
}

.logo {
  margin-right: 3rem;
  display: flex; align-items: center;
}
.logo h2 {
  background: white;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: 1rem;
  margin: 0;
  font-weight: 700;
  letter-spacing: -0.5px;
}

/* Nav is now left-aligned after logo, specific request from screenshot visual */
.nav-menu {
  display: flex;
  gap: 2rem;
  height: 100%;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  height: 100%;
  color: #666;
  font-size: 0.9rem;
  text-decoration: none;
  transition: all 0.2s;
  border-bottom: 2px solid transparent; /* Bottom indicator */
  font-weight: 500;
}

.nav-item:hover {
  color: #aaa;
}

.nav-item.active {
  color: white;
  /* No background, just text color as per screenshot usually implies minimal */
}

/* Right side actions */
.right-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
}

.nav-icon {
  color: var(--col-text-muted);
  cursor: pointer;
}
.nav-icon:hover { color: white; }

.main-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}
</style>
