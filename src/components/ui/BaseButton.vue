<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
}>();

const emit = defineEmits(['click']);

const classes = computed(() => {
  return [
    'base-btn',
    `btn-${props.variant || 'primary'}`,
    { 'is-loading': props.loading }
  ];
});
</script>

<template>
  <button :class="classes" :disabled="disabled || loading" :type="type || 'button'" @click="emit('click', $event)">
    <span v-if="loading" class="spinner"></span>
    <span v-else>
      <slot />
    </span>
  </button>
</template>

<style scoped>
.base-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 1.4rem;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
  transition: var(--anim-fast);
  border: 1px solid transparent;
  width: auto;
  gap: 0.6rem;
  font-size: 0.9rem;
  letter-spacing: 0.5px;
}

.base-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  filter: grayscale(0.5);
}

.btn-primary {
  background: var(--col-primary);
  color: #fff;
  box-shadow: 0 4px 15px rgba(124, 92, 255, 0.4);
  text-transform: uppercase;
}
.btn-primary:hover:not(:disabled) {
  background: var(--col-primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(124, 92, 255, 0.6);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: var(--col-text-main);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.btn-danger {
  background: rgba(255, 50, 50, 0.2);
  color: #ff6060;
  border: 1px solid rgba(255, 50, 50, 0.2);
}
.btn-danger:hover:not(:disabled) {
  background: rgba(255, 50, 50, 0.3);
}

.btn-ghost {
  background: transparent;
  color: var(--col-text-muted);
}
.btn-ghost:hover:not(:disabled) {
  color: var(--col-text-main);
  background: rgba(255, 255, 255, 0.05);
}

.spinner {
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
