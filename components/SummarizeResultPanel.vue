<template>
  <section class="panel">
    <p v-if="result.source_info" class="caption source-meta">
      source: {{ result.source_info.source_type }}
      <span v-if="result.source_info.transcript_type"> / transcript: {{ result.source_info.transcript_type }}</span>
      <span v-if="result.source_info.language_code"> / lang: {{ result.source_info.language_code }}</span>
    </p>

    <h2>要点</h2>
    <ul>
      <li v-for="(point, idx) in result.key_points" :key="`k-${idx}`">
        {{ point }}
      </li>
    </ul>

    <h2>So what</h2>
    <p>{{ result.so_what }}</p>

    <h2>次アクション</h2>
    <ul>
      <li v-for="(action, idx) in result.next_actions" :key="`a-${idx}`">
        {{ action }}
      </li>
    </ul>

    <h2>Open Questions</h2>
    <ul>
      <li v-for="(q, idx) in result.open_questions" :key="`q-${idx}`">
        {{ q }}
      </li>
    </ul>
  </section>

  <section class="panel">
    <h2>Raw JSON</h2>
    <pre>{{ JSON.stringify(result, null, 2) }}</pre>
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

pre {
  background: #f6f6f6;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 12px;
}
</style>
