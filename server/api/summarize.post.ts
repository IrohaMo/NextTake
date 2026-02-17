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
  const source = input.pastedText
    ? `Pasted text:\n${input.pastedText}`
    : `URL: ${input.url}`

  return `
You are an assistant that must return ONLY valid JSON.
Summarize the source into the schema below.

Required schema:
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

Rules:
- Return JSON only. No markdown, no commentary.
- All string values must be written in Japanese.
- "next_actions" must be easy-to-start order.
- "eta_min" should be practical small integers (example: 5, 15, 30).
- If source information is insufficient, keep output structure and put missing points in "open_questions".

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
    const ai = new GoogleGenAI({ apiKey })
    const result = await ai.models.generateContent({
      model,
      contents: buildPrompt({ url, pastedText }),
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
