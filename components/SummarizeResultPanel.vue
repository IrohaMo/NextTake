<template>
  <section class="panel">
    <p v-if="result.source_info" class="caption source-meta">
      source: {{ result.source_info.source_type }}
      <span v-if="result.source_info.transcript_type"> / transcript: {{ result.source_info.transcript_type }}</span>
      <span v-if="result.source_info.language_code"> / lang: {{ result.source_info.language_code }}</span>
    </p>

    <h2>Summary</h2>
    <div class="item-list">
      <div v-for="(point, idx) in result.key_points" :key="`k-${idx}`" class="item-card">
        {{ point }}
      </div>
    </div>

    <h2>So what</h2>
    <p>{{ result.so_what }}</p>

    <h2>Next Take</h2>
    <div class="item-list">
      <div v-for="(action, idx) in result.next_actions" :key="`a-${idx}`" class="item-card">
        {{ action }}
      </div>
    </div>

    <h2>Open Questions</h2>
    <div class="item-list">
      <div v-for="(q, idx) in result.open_questions" :key="`q-${idx}`" class="item-card">
        {{ q }}
      </div>
    </div>
  </section>

</template>

<script setup lang="ts">
defineProps<{
  result: {
    key_points: string[]
    so_what: string
    next_actions: string[]
    open_questions: string[]
    source_info?: {
      source_type: 'youtube' | 'article' | 'pasted_text' | 'unknown'
      transcript_type?: 'auto' | 'manual' | 'none'
      language_code?: string
    }
  }
}>()
</script>

<style scoped>
.panel {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
}

.caption {
  margin-top: -8px;
  color: #555;
}

.source-meta {
  margin-top: 0;
}

.item-list {
  display: grid;
  gap: 8px;
}

.item-card {
  border: 1px solid #e1e1e1;
  border-radius: 6px;
  padding: 10px 12px;
  background: #fff;
}

</style>
