<script setup lang="ts">
defineProps<{
  title?: string;
}>();
</script>

<template>
  <div class="base-card glass-panel">
    <div v-if="title" class="card-header">
      <h3>{{ title }}</h3>
    </div>
    <div class="card-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.base-card {
  padding: 1.5rem;
  overflow: hidden;
  height: 100%;
}

.card-header {
  margin-bottom: 1.2rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.card-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--col-text-main);
  font-weight: 600;
}

.card-content {
  height: 100%;
}
</style>
