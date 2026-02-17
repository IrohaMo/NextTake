<template>
  <div class="page">
    <div class="container">
      <header class="hero">
        <p class="eyebrow">Catch up faster</p>
        <h1>NextTake</h1>
        <p class="caption">記事 or YouTube URLを入力して、要点と次の行動をすぐ確認</p>
      </header>

      <SummarizeInputPanel
        v-model="url"
        :pending="pending"
        :url-message="urlMessage"
        :url-valid="urlValid"
        @submit="submit"
      />

      <p v-if="statusMessage" class="status">
        {{ statusMessage }}
      </p>

      <div v-if="errorMessage" class="error-wrap">
        <p class="error">
          {{ errorMessage }}
        </p>
        <button
          v-if="lastSubmittedUrl"
          class="retry-btn"
          type="button"
          :disabled="pending"
          @click="retryLastRequest"
        >
          再試行
        </button>
      </div>

      <SummarizeResultPanel v-if="result" :result="result" />
    </div>
  </div>
</template>

<script setup lang="ts">
import SummarizeInputPanel from '../components/SummarizeInputPanel.vue'
import SummarizeResultPanel from '../components/SummarizeResultPanel.vue'

type SummarizeResponse = {
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

const url = ref('')
const pending = ref(false)
const errorMessage = ref('')
const statusMessage = ref('')
const result = ref<SummarizeResponse | null>(null)
const lastSubmittedUrl = ref('')
const isDev = import.meta.dev

const ERROR_MESSAGE_MAP: Record<string, string> = {
  INVALID_INPUT: '入力が不足しています。URLを入力してください。',
  INVALID_URL: 'URL形式が不正です。http/https のURLを入力してください。',
  YOUTUBE_VIDEO_ID_NOT_FOUND: 'YouTube URLから動画IDを取得できませんでした。URLを確認してください。',
  CONFIG_ERROR: 'サーバー設定エラーです。管理者に連絡してください。',
  EMPTY_MODEL_RESPONSE: 'AIの応答が空でした。時間をおいて再試行してください。',
  INVALID_MODEL_JSON: 'AI応答の解析に失敗しました。再試行してください。',
  INVALID_MODEL_SCHEMA: 'AI応答の形式が不正でした。再試行してください。',
  QUOTA_EXCEEDED: 'API利用上限に達しました。時間をおいて再試行してください。',
  GEMINI_REQUEST_FAILED: 'AIリクエストに失敗しました。時間をおいて再試行してください。',
}

const urlValid = computed(() => {
  const value = url.value.trim()
  if (!value)
    return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  }
  catch {
    return false
  }
})

const urlType = computed(() => {
  if (!urlValid.value)
    return null
  const host = new URL(url.value.trim()).hostname.toLowerCase()
  if (host.includes('youtube.com') || host.includes('youtu.be'))
    return 'youtube'
  return 'article'
})

const urlMessage = computed(() => {
  const value = url.value.trim()
  if (!value)
    return ''
  if (!urlValid.value)
    return 'URL形式が不正です（http/https を入力してください）。'
  if (urlType.value === 'youtube')
    return 'YouTube URLとして認識しました。動画理解モードで要約します。'
  return '記事URLとして認識しました。本文抽出モードで要約します。'
})

function uiLog(step: string, payload?: unknown) {
  if (!isDev)
    return
  const ts = new Date().toISOString()
  if (payload === undefined) {
    console.info(`[ui][${ts}] ${step}`)
    return
  }
  console.info(`[ui][${ts}] ${step}`, payload)
}

function uiError(...args: unknown[]) {
  if (!isDev)
    return
  console.error(...args)
}

function resolveErrorMessage(error: any): string {
  const code = error?.data?.error?.code as string | undefined
  const apiMessage = error?.data?.error?.message as string | undefined
  if (code && ERROR_MESSAGE_MAP[code])
    return ERROR_MESSAGE_MAP[code]
  if (apiMessage)
    return apiMessage
  if (error instanceof Error && error.message)
    return error.message
  return '通信エラーが発生しました。'
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
  lastSubmittedUrl.value = trimmedUrl
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
    const msg = resolveErrorMessage(error)
    errorMessage.value = msg
    statusMessage.value = '要約の取得に失敗しました。'
    uiError('[ui] summarize request failed', msg, error)
  }
  finally {
    pending.value = false
    uiLog('summarize request finished')
  }
}

async function retryLastRequest() {
  if (!lastSubmittedUrl.value || pending.value)
    return
  url.value = lastSubmittedUrl.value
  await submit()
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background:
    radial-gradient(1200px 600px at 90% -20%, #d8efe5 0%, transparent 65%),
    radial-gradient(1000px 500px at -10% -10%, #f4dfcf 0%, transparent 60%),
    #f8f7f4;
}

.container {
  max-width: 860px;
  margin: 0 auto;
  padding: 32px 16px 48px;
  font-family: "Avenir Next", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
}

.hero {
  margin-bottom: 12px;
}

.eyebrow {
  margin: 0;
  color: #6e6a60;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.caption {
  margin-top: 6px;
  color: #5b5750;
}

.error {
  margin: 0;
  color: #c62828;
}

.status {
  margin-top: 12px;
  color: #2e493c;
  background: #e6f4ee;
  border: 1px solid #c6e4d8;
  padding: 10px 12px;
  border-radius: 8px;
}

.error-wrap {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  background: #fdecec;
  border: 1px solid #f3c6c6;
  padding: 10px 12px;
  border-radius: 8px;
}

.retry-btn {
  padding: 8px 12px;
  border: 1px solid #b78f8f;
  border-radius: 6px;
  background: #fff7f7;
  color: #5c2b2b;
  cursor: pointer;
}

.retry-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
