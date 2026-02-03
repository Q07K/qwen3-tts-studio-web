<script setup lang="ts">
defineProps<{
  modelValue: string | number;
  label?: string;
  placeholder?: string;
  type?: string;
  id?: string;
  required?: boolean;
}>();

defineEmits(['update:modelValue']);
</script>

<template>
  <div class="input-group">
    <label v-if="label" :for="id" class="label">
      {{ label }} <span v-if="required" class="required">*</span>
    </label>
    <div class="input-wrapper">
      <input
        :id="id"
        :type="type || 'text'"
        :value="modelValue"
        :placeholder="placeholder"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        class="input-field"
        :required="required"
      />
    </div>
  </div>
</template>

<style scoped>
.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--col-text-muted);
  margin-left: 0.2rem;
}

.required {
  color: #ff6060;
}

.input-field {
  width: 100%;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--col-border);
  border-radius: var(--radius-sm);
  padding: 0.7rem 1rem;
  color: var(--col-text-main);
  transition: var(--anim-fast);
  box-sizing: border-box;
}

.input-field:focus {
  outline: none;
  border-color: var(--col-primary);
  box-shadow: 0 0 0 3px rgba(var(--hue-primary), 0.2);
  background: rgba(0, 0, 0, 0.3);
}

.input-field::placeholder {
  color: rgba(255, 255, 255, 0.2);
}
</style>
