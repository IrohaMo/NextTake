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

    <p v-if="errorMessage" class="error">
      {{ errorMessage }}
    </p>

    <section v-if="result" class="panel">
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
}

const url = ref('')
const pending = ref(false)
const errorMessage = ref('')
const result = ref<SummarizeResponse | null>(null)

async function submit() {
  const trimmedUrl = url.value.trim()
  if (!trimmedUrl) {
    errorMessage.value = 'URLを入力してください。'
    return
  }

  pending.value = true
  errorMessage.value = ''
  result.value = null
  console.info('[ui] summarize request started')
  await nextTick()

  try {
    const res = await $fetch<SummarizeResponse>('/api/summarize', {
      method: 'POST',
      body: { url: trimmedUrl },
    })
    result.value = res
    console.info('[ui] summarize request succeeded')
  }
  catch (error: any) {
    const msg = error?.data?.error?.message || (error instanceof Error ? error.message : '通信エラーが発生しました。')
    errorMessage.value = msg
    console.error('[ui] summarize request failed', msg)
  }
  finally {
    pending.value = false
    console.info('[ui] summarize request finished')
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

pre {
  background: #f6f6f6;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 12px;
}
</style>
