'use client'

import {useCallback, useEffect, useState} from 'react'
import type {FileSource, LoadStatus} from '../types'
import {fetchAsArrayBuffer} from '../utils/fetch-file'
import {
  isFileBufferValidationError,
  type FileBufferValidator,
} from '../utils/validate-file-buffer'

export interface UseFileSourceOptions {
  /** 文件读取完成后的格式校验。 */
  validate?: FileBufferValidator
  /** URL 内容校验失败后的自动重试次数，默认 2 次。 */
  validationRetryCount?: number
  /** URL 请求缓存策略。手动刷新时可传入 `no-store` 强制读取最新内容。 */
  cache?: RequestCache
}

export interface UseFileSourceResult {
  buffer: ArrayBuffer | undefined
  loading: boolean
  error: Error | undefined
  status: LoadStatus
  /** 重新加载 */
  reload: () => void
}

interface FileLoadState {
  source: FileSource
  reloadTick: number
  validate: FileBufferValidator | undefined
  validationRetryCount: number
  cache: RequestCache | undefined
  buffer?: ArrayBuffer
  error?: Error
}

const DEFAULT_VALIDATION_RETRY_COUNT = 2
const VALIDATION_RETRY_DELAYS = [250, 750] as const

/**
 * 加载文件源为 ArrayBuffer，带取消机制和重试。
 *
 * 状态会同时记录对应的 source 与重试版本。切换文件后的首次渲染不会复用上一文件的
 * ArrayBuffer，避免新文件类型的预览器误解析旧文件内容。
 *
 * @param source 文件源
 * @param options 文件校验与重试配置
 *
 * @example
 * const {buffer, loading, error, reload} = useFileSource(src)
 */
export function useFileSource(
  source: FileSource,
  {
    validate,
    validationRetryCount = DEFAULT_VALIDATION_RETRY_COUNT,
    cache,
  }: UseFileSourceOptions = {},
): UseFileSourceResult {
  const [reloadTick, setReloadTick] = useState(0)
  const [state, setState] = useState<FileLoadState>(() => ({
    source,
    reloadTick,
    validate,
    validationRetryCount,
    cache,
  }))

  const isCurrentRequest = state.source === source
    && state.reloadTick === reloadTick
    && state.validate === validate
    && state.validationRetryCount === validationRetryCount
    && state.cache === cache
  const buffer = isCurrentRequest ? state.buffer : undefined
  const error = isCurrentRequest ? state.error : undefined
  const loading = !buffer && !error
  const status: LoadStatus = error ? 'error' : buffer ? 'success' : loading ? 'loading' : 'idle'

  const reload = useCallback(() => {
    setReloadTick((tick) => tick + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    const requestState = {source, reloadTick, validate, validationRetryCount, cache}

    setState(requestState)

    const load = async () => {
      const isUrlSource = typeof source === 'string' || 'url' in source
      const maxAttempts = isUrlSource ? Math.max(1, validationRetryCount + 1) : 1

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const nextBuffer = await fetchAsArrayBuffer(source, {
            signal: controller.signal,
            // 手动刷新和带格式校验的文件均不复用浏览器缓存，避免读取旧内容或不完整响应。
            cache: cache ?? (validate ? 'no-store' : undefined),
          })
          validate?.(nextBuffer)

          if (!cancelled) {
            setState({...requestState, buffer: nextBuffer})
          }
          return
        } catch (caughtError: unknown) {
          if (cancelled || controller.signal.aborted) return

          const canRetry = isFileBufferValidationError(caughtError) && attempt < maxAttempts - 1
          if (canRetry) {
            const delay = VALIDATION_RETRY_DELAYS[attempt] ?? 750
            await wait(delay, controller.signal)
            continue
          }

          setState({
            ...requestState,
            error: caughtError instanceof Error ? caughtError : new Error(String(caughtError)),
          })
          return
        }
      }
    }

    void load()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [cache, reloadTick, source, validate, validationRetryCount])

  return {buffer, loading, error, status, reload}
}

/** 等待下一次校验重试，并支持组件卸载时立即取消。 */
function wait(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }

    const handleAbort = () => {
      window.clearTimeout(timer)
      resolve()
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }, delay)

    signal.addEventListener('abort', handleAbort, {once: true})
  })
}
