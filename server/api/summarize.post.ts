import { GoogleGenAI } from '@google/genai'
import type { H3Event } from 'h3'

type SummarizeRequest = {
  url?: string
  pasted_text?: string
}

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

const MAX_INPUT_CHARS = 12_000
const FETCH_TIMEOUT_MS = 15_000
const IS_DEV = process.env.NODE_ENV !== 'production'

function logInfo(...args: unknown[]) {
  if (IS_DEV)
    console.info(...args)
}

function logWarn(...args: unknown[]) {
  if (IS_DEV)
    console.warn(...args)
}

function logError(...args: unknown[]) {
  console.error(...args)
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
  sourceInfo: NonNullable<SummarizeResponse['source_info']>
  sourceError?: { status: number, code: string, message: string }
}> {
  if (input.pastedText) {
    return {
      sourceText: input.pastedText,
      sourceLabel: 'pasted_text',
      sourceInfo: {
        source_type: 'pasted_text',
        transcript_type: 'none',
      },
    }
  }

  if (!input.url) {
    return {
      sourceText: '',
      sourceLabel: 'none',
      sourceInfo: {
        source_type: 'unknown',
        transcript_type: 'none',
      },
    }
  }

  if (isYouTubeUrl(input.url)) {
    const videoId = getYouTubeVideoId(input.url)
    if (!videoId) {
      logWarn(`[summarize][${input.requestId}] youtube url detected but video id not found`)
      return {
        sourceText: '',
        sourceLabel: 'youtube_transcript_error',
        sourceInfo: {
          source_type: 'youtube',
          transcript_type: 'none',
        },
        sourceError: {
          status: 422,
          code: 'YOUTUBE_VIDEO_ID_NOT_FOUND',
          message: 'YouTube URL から動画IDを取得できませんでした。',
        },
      }
    }
    return {
      sourceText: '',
      sourceLabel: 'youtube_file_uri',
      sourceInfo: {
        source_type: 'youtube',
        transcript_type: 'none',
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
      logWarn(`[summarize][${input.requestId}] source fetch failed with status ${response.status}`)
      return {
        sourceText: `URL: ${input.url}`,
        sourceLabel: 'url_only',
        sourceInfo: {
          source_type: 'article',
          transcript_type: 'none',
        },
      }
    }

    const html = await response.text()
    const title = extractTitleFromHtml(html)
    const body = extractMainTextFromHtml(html)
    const merged = cleanText(`${title ? `Title: ${title}\n` : ''}${body}`).slice(0, MAX_INPUT_CHARS)

    if (!merged) {
      logWarn(`[summarize][${input.requestId}] source extraction empty`)
      return {
        sourceText: `URL: ${input.url}`,
        sourceLabel: 'url_only',
        sourceInfo: {
          source_type: 'article',
          transcript_type: 'none',
        },
      }
    }

    return {
      sourceText: merged,
      sourceLabel: 'fetched_article',
      sourceInfo: {
        source_type: 'article',
        transcript_type: 'none',
      },
    }
  }
  catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown'
    logWarn(`[summarize][${input.requestId}] source fetch error: ${msg}`)
    return {
      sourceText: `URL: ${input.url}`,
      sourceLabel: 'url_only',
      sourceInfo: {
        source_type: 'article',
        transcript_type: 'none',
      },
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

  return (
    isStringArray(v.key_points)
    && typeof v.so_what === 'string'
    && isStringArray(v.next_actions)
    && isStringArray(v.open_questions)
  )
}

function buildPrompt(input: { url?: string, pastedText?: string }) {
  const source = input.pastedText
    ? `Pasted text:\n${input.pastedText}`
    : `URL: ${input.url}`

  return `
You must return ONLY valid JSON.
No markdown.
No explanation.
No commentary.
No code fences.

Schema:
{
  "key_points": string[],
  "so_what": string,
  "next_actions": string[],
  "open_questions": string[]
}

Strict rules:

General:
- All strings must be written in Japanese.
- Do NOT refer to the source as 「この記事」「この動画」「本記事」「本動画」など。
- Do NOT write meta comments.
- Do NOT repeat the schema.

key_points:
- Extract article/video-specific claims only.
- No abstract filler words such as:
  「必要性」「課題」「複雑化」「重要」「動向」「影響」「議論」「可能性」
- Each item must describe an observable fact, instruction, or claim.
- Prefer concrete nouns, actions, or numbers if available.

so_what:
- Explain why this content matters in practical life.
- Must describe a real-world effect or benefit.
- No abstract general statements.

next_actions:
- Must be step-by-step executable instructions.
- Each item must start with a concrete action verb.
- No vague verbs such as:
  「調査する」「検討する」「把握する」「考察する」「学習する」
- Include concrete numbers if possible (e.g. 3本, 1周, 5分以内).
- Do NOT say 「動画で紹介された方法」などの参照表現。
- Each instruction must be executable immediately without re-reading the source.

open_questions:
- Only include meaningful unresolved uncertainties.
- If information is unclear, place it here instead of guessing.

Source:
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

  logInfo(`[summarize][${requestId}] start`, {
    hasUrl: Boolean(url),
    pastedTextChars: pastedText?.length ?? 0,
  })

  if (!url && !pastedText) {
    logWarn(`[summarize][${requestId}] invalid input: missing url/pasted_text`)
    return errorResponse(event, 400, 'INVALID_INPUT', 'Either "url" or "pasted_text" is required.')
  }
  logInfo(`[summarize][${requestId}] input validation passed`)

  if (url && !isHttpUrl(url)) {
    logWarn(`[summarize][${requestId}] invalid url format`)
    return errorResponse(event, 400, 'INVALID_URL', 'URL must be http/https format.')
  }
  if (url) {
    logInfo(`[summarize][${requestId}] url format check passed`)
  }

  const runtimeConfig = useRuntimeConfig(event)
  const apiKey = runtimeConfig.geminiApiKey as string | undefined
  const model = runtimeConfig.geminiModel as string | undefined

  if (!apiKey) {
    logError(`[summarize][${requestId}] missing GEMINI_API_KEY`)
    return errorResponse(event, 500, 'CONFIG_ERROR', 'Missing GEMINI_API_KEY.')
  }
  if (!model) {
    logError(`[summarize][${requestId}] missing geminiModel`)
    return errorResponse(event, 500, 'CONFIG_ERROR', 'Missing geminiModel in runtime config.')
  }

  try {
    logInfo(`[summarize][${requestId}] resolving source text`)
    const { sourceText, sourceLabel, sourceInfo, sourceError } = await resolveSourceText({ requestId, url, pastedText })
    logInfo(`[summarize][${requestId}] source resolved`, {
      sourceLabel,
      sourceChars: sourceText.length,
      sourceInfo,
    })
    if (sourceError) {
      logWarn(`[summarize][${requestId}] source error`, sourceError.code)
      return errorResponse(event, sourceError.status, sourceError.code, sourceError.message)
    }

    const ai = new GoogleGenAI({ apiKey })
    const isYoutubeInput = Boolean(url && isYouTubeUrl(url) && !pastedText)
    logInfo(`[summarize][${requestId}] calling gemini`, { model, isYoutubeInput })
    const contents: any = isYoutubeInput
      ? [
          {
            fileData: {
              fileUri: url,
              mimeType: 'video/*',
            },
          },
          { text: buildPrompt({ url: url! }) },
        ]
      : buildPrompt({ url, pastedText: sourceText })

    const result = await ai.models.generateContent({
      model,
      contents,
	  config: {
		temperature: 0.2,
	  }
    })
    logInfo(`[summarize][${requestId}] gemini response received`)

    const rawText = String(result.text || '').trim()
    if (!rawText) {
      logError(`[summarize][${requestId}] empty model response`)
      return errorResponse(event, 502, 'EMPTY_MODEL_RESPONSE', 'Model returned an empty response.')
    }

    let parsed: unknown
    try {
      logInfo(`[summarize][${requestId}] parsing model json`)
      parsed = JSON.parse(stripCodeFence(rawText))
    }
    catch {
      logError(`[summarize][${requestId}] invalid model json`)
      return errorResponse(event, 502, 'INVALID_MODEL_JSON', 'Model response was not valid JSON.')
    }

    logInfo(`[summarize][${requestId}] validating response schema`)
    if (!isValidSummarizeResponse(parsed)) {
      logError(`[summarize][${requestId}] invalid model schema`)
      return errorResponse(event, 502, 'INVALID_MODEL_SCHEMA', 'Model response did not match expected schema.')
    }

    logInfo(`[summarize][${requestId}] success in ${Date.now() - startedAt}ms`)
    return {
      ...parsed,
      source_info: sourceInfo,
    }
  }
  catch (error: unknown) {
    const maybeError = error as { status?: number, message?: string }

    if (maybeError?.status === 429) {
      logWarn(`[summarize][${requestId}] quota exceeded in ${Date.now() - startedAt}ms`)
      return errorResponse(event, 429, 'QUOTA_EXCEEDED', 'Gemini quota exceeded. Please check plan/billing and retry.')
    }

    logError(`[summarize][${requestId}] failed in ${Date.now() - startedAt}ms`, maybeError?.message)
    return errorResponse(
      event,
      500,
      'GEMINI_REQUEST_FAILED',
      maybeError?.message || 'Failed to call Gemini API.',
    )
  }
})
