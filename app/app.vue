<template>
  <div class="container">
    <h1>NextTake</h1>
    <p class="caption">記事 or YouTube URLを入力して要約JSONを取得</p>

    <form class="panel" novalidate @submit.prevent="submit">
      <label for="url">URL</label>
      <input
        id="url"
        v-model="url"
        type="text"
        placeholder="https://example.com/article"
      >

      <button type="submit" :disabled="pending">
        {{ pending ? '生成中...' : '要約する' }}
      </button>
    </form>

    <p v-if="statusMessage" class="status">
      {{ statusMessage }}
    </p>

    <p v-if="errorMessage" class="error">
      {{ errorMessage }}
    </p>

    <section v-if="result" class="panel">
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
          {{ action.text }} ({{ action.eta_min }}分)
        </li>
      </ul>

      <h2>Open Questions</h2>
      <ul>
        <li v-for="(q, idx) in result.open_questions" :key="`q-${idx}`">
          {{ q }}
        </li>
      </ul>
    </section>

    <section v-if="result" class="panel">
      <h2>Raw JSON</h2>
      <pre>{{ JSON.stringify(result, null, 2) }}</pre>
    </section>
  </div>
</template>

<script setup lang="ts">
type SummarizeResponse = {
  key_points: string[]
  so_what: string
  next_actions: Array<{ text: string, eta_min: number }>
  open_questions: string[]
  source_info?: {
    source_type: 'youtube' | 'article' | 'pasted_text' | 'unknown'
    transcript_type?: 'auto' | 'manual' | 'none'
    language_code?: string
  }
}

const url = ref('')
const pending = ref(false)
const errorMessage = ref('')
const statusMessage = ref('')
const result = ref<SummarizeResponse | null>(null)

function uiLog(step: string, payload?: unknown) {
  const ts = new Date().toISOString()
  if (payload === undefined) {
    console.info(`[ui][${ts}] ${step}`)
    return
  }
  console.info(`[ui][${ts}] ${step}`, payload)
}

async function submit() {
  uiLog('submit clicked')
  const trimmedUrl = url.value.trim()
  uiLog('url validated', { hasUrl: Boolean(trimmedUrl), urlLength: trimmedUrl.length })
  if (!trimmedUrl) {
    statusMessage.value = ''
    errorMessage.value = 'URLを入力してください。'
    uiLog('submit blocked: empty url')
    return
  }

  pending.value = true
  statusMessage.value = 'リクエスト送信中...'
  errorMessage.value = ''
  result.value = null
  uiLog('summarize request started')
  await nextTick()
  uiLog('ui state updated: pending=true')

  try {
    uiLog('calling /api/summarize')
    const res = await $fetch<SummarizeResponse>('/api/summarize', {
      method: 'POST',
      body: { url: trimmedUrl },
    })
    result.value = res
    statusMessage.value = '要約を取得しました。'
    uiLog('summarize request succeeded', {
      keyPoints: res.key_points?.length || 0,
      nextActions: res.next_actions?.length || 0,
      transcriptType: res.source_info?.transcript_type || 'none',
    })
  }
  catch (error: any) {
    const msg = error?.data?.error?.message || (error instanceof Error ? error.message : '通信エラーが発生しました。')
    errorMessage.value = msg
    statusMessage.value = '要約の取得に失敗しました。'
    console.error('[ui] summarize request failed', msg, error)
  }
  finally {
    pending.value = false
    uiLog('summarize request finished')
  }
}
</script>

<style scoped>
.container {
  max-width: 760px;
  margin: 40px auto;
  padding: 0 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.caption {
  margin-top: -8px;
  color: #555;
}

.source-meta {
  margin-top: 0;
}

.panel {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
}

label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
}

input {
  width: 100%;
  padding: 10px;
  margin-bottom: 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
}

button {
  padding: 10px 14px;
  border: 0;
  border-radius: 6px;
  background: #111;
  color: #fff;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  margin-top: 12px;
  color: #c62828;
}

.status {
  margin-top: 12px;
  color: #333;
}

pre {
  background: #f6f6f6;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 12px;
}
</style>
