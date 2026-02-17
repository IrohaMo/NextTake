<template>
  <form class="panel" novalidate @submit.prevent="$emit('submit')">
    <label for="url">URL</label>
    <input
      id="url"
      :value="modelValue"
      type="text"
      placeholder="https://example.com/article"
      @input="onInput"
    >

    <p v-if="urlMessage" class="hint" :class="{ invalid: !urlValid }">
      {{ urlMessage }}
    </p>

    <button type="submit" :disabled="pending">
      {{ pending ? '生成中...' : '要約する' }}
    </button>
  </form>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
  pending: boolean
  urlMessage: string
  urlValid: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
}>()

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement | null)?.value || ''
  emit('update:modelValue', value)
}
</script>

<style scoped>
.panel {
  border: 1px solid #ded8cf;
  border-radius: 12px;
  padding: 18px;
  margin-top: 16px;
  background: #fffdf9;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
}

label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
}

input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  margin-bottom: 12px;
  border: 1px solid #cbc6bd;
  border-radius: 6px;
  background: #fff;
}

button {
  padding: 10px 14px;
  border: 1px solid #1f3f32;
  border-radius: 6px;
  background: #264a3b;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s ease;
}

button:hover {
  background: #1f3f32;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hint {
  margin-top: -4px;
  margin-bottom: 12px;
  color: #2d5a48;
  font-size: 13px;
}

.hint.invalid {
  color: #c62828;
}
</style>
