import { GoogleGenAI } from '@google/genai'
import type { H3Event } from 'h3'

type SummarizeRequest = {
  url?: string
  pasted_text?: string
}

type SummarizeResponse = {
  key_points: string[]
  so_what: string
  next_actions: Array<{ text: string; eta_min: number }>
  open_questions: string[]
}

const MAX_INPUT_CHARS = 12_000
const FETCH_TIMEOUT_MS = 15_000

function errorResponse(event: H3Event, status: number, code: string, message: string) {
  setResponseStatus(event, status)
  return { error: { code, message } }
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  }
  catch {
    return false
  }
}

function stripCodeFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
}

function cleanText(text: string): string {
  return decodeHtmlEntities(text).replace(/\s+/g, ' ').trim()
}

function isYouTubeUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return host.includes('youtube.com') || host.includes('youtu.be')
  }
  catch {
    return false
  }
}

function getYouTubeVideoId(value: string): string | null {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()

    if (host.includes('youtu.be')) {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id || null
    }

    if (host.includes('youtube.com')) {
      const v = url.searchParams.get('v')
      if (v)
        return v

      const parts = url.pathname.split('/').filter(Boolean)
      if (parts[0] === 'shorts' && parts[1])
        return parts[1]
      if (parts[0] === 'embed' && parts[1])
        return parts[1]
    }

    return null
  }
  catch {
    return null
  }
}

function extractJsonObjectAfterMarker(text: string, marker: string): string | null {
  const markerIndex = text.indexOf(marker)
  if (markerIndex === -1)
    return null

  const start = text.indexOf('{', markerIndex)
  if (start === -1)
    return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (inString) {
      if (escaped) {
        escaped = false
      }
      else if (ch === '\\') {
        escaped = true
      }
      else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '{')
      depth++
    else if (ch === '}')
      depth--

    if (depth === 0) {
      return text.slice(start, i + 1)
    }
  }

  return null
}

function extractTranscriptFromJson3(raw: unknown): string {
  if (!raw || typeof raw !== 'object')
    return ''

  const root = raw as { events?: Array<{ segs?: Array<{ utf8?: string }> }> }
  const chunks: string[] = []

  for (const event of root.events || []) {
    for (const seg of event.segs || []) {
      if (typeof seg.utf8 === 'string')
        chunks.push(seg.utf8)
    }
  }

  return cleanText(chunks.join(' '))
}

function extractTranscriptFromXml(xml: string): string {
  const matches = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi)]
  const chunks = matches.map(m => cleanText(m[1]))
  return cleanText(chunks.join(' '))
}

async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
  const watchRes = await fetch(watchUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (NextTakeBot)',
      'accept-language': 'ja,en-US;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!watchRes.ok)
    return ''

  const html = await watchRes.text()
  const playerJsonText = extractJsonObjectAfterMarker(html, 'ytInitialPlayerResponse =')
    || extractJsonObjectAfterMarker(html, 'var ytInitialPlayerResponse =')
  if (!playerJsonText)
    return ''

  let player: any
  try {
    player = JSON.parse(playerJsonText)
  }
  catch {
    return ''
  }

  const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks as Array<{
    baseUrl?: string
    languageCode?: string
    kind?: string
  }> | undefined
  if (!tracks?.length)
    return ''

  const selectedTrack = tracks.find(t => (t.languageCode || '').startsWith('ja'))
    || tracks.find(t => (t.languageCode || '').startsWith('en'))
    || tracks.find(t => t.kind === 'asr')
    || tracks[0]
  if (!selectedTrack?.baseUrl)
    return ''

  const json3Url = selectedTrack.baseUrl.includes('fmt=')
    ? selectedTrack.baseUrl
    : `${selectedTrack.baseUrl}&fmt=json3`
  const transcriptRes = await fetch(json3Url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (NextTakeBot)',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!transcriptRes.ok)
    return ''

  const contentType = transcriptRes.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const json = await transcriptRes.json()
    return extractTranscriptFromJson3(json)
  }

  const xml = await transcriptRes.text()
  return extractTranscriptFromXml(xml)
}

function extractTitleFromHtml(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? cleanText(m[1]) : ''
}

function extractMainTextFromHtml(html: string): string {
  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')

  const bodyMatch = noScript.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const bodyHtml = bodyMatch ? bodyMatch[1] : noScript
  const textOnly = bodyHtml.replace(/<[^>]+>/g, ' ')
  return cleanText(textOnly)
}

async function resolveSourceText(input: {
  requestId: string
  url?: string
  pastedText?: string
}): Promise<{
  sourceText: string
  sourceLabel: string
  sourceError?: { status: number, code: string, message: string }
}> {
  if (input.pastedText) {
    return {
      sourceText: input.pastedText,
      sourceLabel: 'pasted_text',
    }
  }

  if (!input.url) {
    return {
      sourceText: '',
      sourceLabel: 'none',
    }
  }

  if (isYouTubeUrl(input.url)) {
    const videoId = getYouTubeVideoId(input.url)
    if (!videoId) {
      console.warn(`[summarize][${input.requestId}] youtube url detected but video id not found`)
      return {
        sourceText: '',
        sourceLabel: 'youtube_transcript_error',
        sourceError: {
          status: 422,
          code: 'YOUTUBE_VIDEO_ID_NOT_FOUND',
          message: 'YouTube URL から動画IDを取得できませんでした。',
        },
      }
    }

    const transcript = await fetchYouTubeTranscript(videoId)
    if (transcript) {
      return {
        sourceText: transcript.slice(0, MAX_INPUT_CHARS),
        sourceLabel: 'youtube_transcript',
      }
    }

    console.warn(`[summarize][${input.requestId}] youtube transcript unavailable`)
    return {
      sourceText: '',
      sourceLabel: 'youtube_transcript_error',
      sourceError: {
        status: 422,
        code: 'YOUTUBE_TRANSCRIPT_UNAVAILABLE',
        message: 'この動画は字幕を取得できないため要約できませんでした。',
      },
    }
  }

  try {
    const response = await fetch(input.url, {
      headers: {
        'user-agent': 'NextTakeBot/0.1 (+https://nexttake.local)',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!response.ok) {
      console.warn(`[summarize][${input.requestId}] source fetch failed with status ${response.status}`)
      return {
        sourceText: `URL: ${input.url}`,
        sourceLabel: 'url_only',
      }
    }

    const html = await response.text()
    const title = extractTitleFromHtml(html)
    const body = extractMainTextFromHtml(html)
    const merged = cleanText(`${title ? `Title: ${title}\n` : ''}${body}`).slice(0, MAX_INPUT_CHARS)

    if (!merged) {
      console.warn(`[summarize][${input.requestId}] source extraction empty`)
      return {
        sourceText: `URL: ${input.url}`,
        sourceLabel: 'url_only',
      }
    }

    return {
      sourceText: merged,
      sourceLabel: 'fetched_article',
    }
  }
  catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown'
    console.warn(`[summarize][${input.requestId}] source fetch error: ${msg}`)
    return {
      sourceText: `URL: ${input.url}`,
      sourceLabel: 'url_only',
    }
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string')
}

function isValidSummarizeResponse(value: unknown): value is SummarizeResponse {
  if (!value || typeof value !== 'object')
    return false

  const v = value as Record<string, unknown>
  const nextActions = v.next_actions

  const validNextActions = Array.isArray(nextActions) && nextActions.every((item) => {
    if (!item || typeof item !== 'object')
      return false

    const row = item as Record<string, unknown>
    return typeof row.text === 'string' && typeof row.eta_min === 'number' && Number.isInteger(row.eta_min)
  })

  return (
    isStringArray(v.key_points)
    && typeof v.so_what === 'string'
    && validNextActions
    && isStringArray(v.open_questions)
  )
}

function buildPrompt(input: { url?: string, pastedText?: string }) {
  const source = input.pastedText || ''
  const sourceInfo = input.url ? `Source URL: ${input.url}` : 'Source URL: (none)'

  return `
You must return ONLY valid JSON.
No markdown. No explanation. Only JSON.

Schema:
{
  "key_points": string[],
  "so_what": string,
  "next_actions": [
    { "text": string, "eta_min": number },
    { "text": string, "eta_min": number },
    { "text": string, "eta_min": number }
  ],
  "open_questions": string[]
}

Strict rules:
- All strings must be written in Japanese.
- key_points must include source-specific claims. Do not write general AI commentary.
- Do NOT use abstract filler words such as:
  「必要性」「課題」「複雑化」「動向」「重要」「影響」「議論」
- so_what must describe why THIS article matters to the reader's real-world action.
- next_actions must be concrete and executable within 30 minutes each.
- next_actions must start with a specific verb.
- Prohibited verbs: 「調査する」「検討する」「把握する」「考察する」「学習する」
- If article lacks clarity, use open_questions instead of guessing.
- Do not invent facts that are not explicitly present in the source text.

Source:
${sourceInfo}
${source}
`.trim()
}

export default defineEventHandler(async (event) => {
  const requestId = `sum_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const startedAt = Date.now()
  const body = await readBody<SummarizeRequest>(event)
  const url = typeof body?.url === 'string' ? body.url.trim() : undefined
  const pastedText = typeof body?.pasted_text === 'string'
    ? body.pasted_text.slice(0, MAX_INPUT_CHARS)
    : undefined

  console.info(`[summarize][${requestId}] start`, {
    hasUrl: Boolean(url),
    pastedTextChars: pastedText?.length ?? 0,
  })

  if (!url && !pastedText) {
    console.warn(`[summarize][${requestId}] invalid input: missing url/pasted_text`)
    return errorResponse(event, 400, 'INVALID_INPUT', 'Either "url" or "pasted_text" is required.')
  }

  if (url && !isHttpUrl(url)) {
    console.warn(`[summarize][${requestId}] invalid url format`)
    return errorResponse(event, 400, 'INVALID_URL', 'URL must be http/https format.')
  }

  const runtimeConfig = useRuntimeConfig(event)
  const apiKey = runtimeConfig.geminiApiKey as string | undefined
  const model = runtimeConfig.geminiModel as string | undefined

  if (!apiKey) {
    console.error(`[summarize][${requestId}] missing GEMINI_API_KEY`)
    return errorResponse(event, 500, 'CONFIG_ERROR', 'Missing GEMINI_API_KEY.')
  }
  if (!model) {
    console.error(`[summarize][${requestId}] missing geminiModel`)
    return errorResponse(event, 500, 'CONFIG_ERROR', 'Missing geminiModel in runtime config.')
  }

  try {
    const { sourceText, sourceLabel, sourceError } = await resolveSourceText({ requestId, url, pastedText })
    console.info(`[summarize][${requestId}] source resolved`, {
      sourceLabel,
      sourceChars: sourceText.length,
    })
    if (sourceError) {
      console.warn(`[summarize][${requestId}] source error`, sourceError.code)
      return errorResponse(event, sourceError.status, sourceError.code, sourceError.message)
    }

    const ai = new GoogleGenAI({ apiKey })
    const result = await ai.models.generateContent({
      model,
      contents: buildPrompt({ url, pastedText: sourceText }),
	  config: {
		temperature: 0.2,
	  }
    })

    const rawText = String(result.text || '').trim()
    if (!rawText) {
      console.error(`[summarize][${requestId}] empty model response`)
      return errorResponse(event, 502, 'EMPTY_MODEL_RESPONSE', 'Model returned an empty response.')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(stripCodeFence(rawText))
    }
    catch {
      console.error(`[summarize][${requestId}] invalid model json`)
      return errorResponse(event, 502, 'INVALID_MODEL_JSON', 'Model response was not valid JSON.')
    }

    if (!isValidSummarizeResponse(parsed)) {
      console.error(`[summarize][${requestId}] invalid model schema`)
      return errorResponse(event, 502, 'INVALID_MODEL_SCHEMA', 'Model response did not match expected schema.')
    }

    console.info(`[summarize][${requestId}] success in ${Date.now() - startedAt}ms`)
    return parsed
  }
  catch (error: unknown) {
    const maybeError = error as { status?: number, message?: string }

    if (maybeError?.status === 429) {
      console.warn(`[summarize][${requestId}] quota exceeded in ${Date.now() - startedAt}ms`)
      return errorResponse(event, 429, 'QUOTA_EXCEEDED', 'Gemini quota exceeded. Please check plan/billing and retry.')
    }

    console.error(`[summarize][${requestId}] failed in ${Date.now() - startedAt}ms`, maybeError?.message)
    return errorResponse(
      event,
      500,
      'GEMINI_REQUEST_FAILED',
      maybeError?.message || 'Failed to call Gemini API.',
    )
  }
})
