<template>
  <section class="panel">
    <div v-if="result.source_info" class="meta-row">
      <span class="meta-chip">source: {{ result.source_info.source_type }}</span>
      <span v-if="result.source_info.transcript_type" class="meta-chip">transcript: {{ result.source_info.transcript_type }}</span>
      <span v-if="result.source_info.language_code" class="meta-chip">lang: {{ result.source_info.language_code }}</span>
    </div>

    <h2>Summary</h2>
    <ul class="line-list">
      <li v-for="(point, idx) in result.key_points" :key="`k-${idx}`" class="line-item">
        {{ point }}
      </li>
    </ul>

    <h2>So what</h2>
    <p class="so-what">{{ result.so_what }}</p>

    <h2>Next Take</h2>
    <ul class="line-list">
      <li v-for="(action, idx) in result.next_actions" :key="`a-${idx}`" class="line-item">
        {{ action }}
      </li>
    </ul>

    <h2>Open Questions</h2>
    <ul class="line-list">
      <li v-for="(q, idx) in result.open_questions" :key="`q-${idx}`" class="line-item">
        {{ q }}
      </li>
    </ul>
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
  border: 1px solid #ded8cf;
  border-radius: 12px;
  padding: 18px;
  margin-top: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
}

h2 {
  margin: 20px 0 10px;
  font-size: 16px;
}

h2:first-of-type {
  margin-top: 10px;
}

.meta-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.meta-chip {
  font-size: 12px;
  color: #3d5f51;
  background: #eaf5ef;
  border: 1px solid #cfe6da;
  border-radius: 999px;
  padding: 3px 8px;
}

.so-what {
  margin: 0;
  line-height: 1.7;
  color: #2f2c27;
}

.line-list {
  margin: 0;
  padding-left: 20px;
  display: grid;
  gap: 8px;
}

.line-item {
  line-height: 1.6;
}

</style>
