"use client"

import {useEffect, useState} from "react"

import {
  createServerCountdown,
  getInitialServerRemainingMs,
  type ServerTimedPayload,
} from "../../lib/server-countdown"

interface UseServerCountdownOptions {
  /** 是否启动倒计时。 */
  enabled?: boolean
}

/**
 * 使用服务端事件时间初始化，并通过浏览器单调时钟递减的倒计时。
 */
export function useServerCountdown(
  {serverNow, timeoutAt}: ServerTimedPayload,
  {enabled = true}: UseServerCountdownOptions = {},
) {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.ceil(getInitialServerRemainingMs({serverNow, timeoutAt}) / 1000),
  )

  useEffect(() => {
    const initialRemainingSeconds = Math.ceil(
      getInitialServerRemainingMs({serverNow, timeoutAt}) / 1000,
    )
    setRemainingSeconds(initialRemainingSeconds)

    if (!enabled) return

    const countdown = createServerCountdown({serverNow, timeoutAt})
    const updateRemainingSeconds = () => {
      const seconds = countdown.remainingSeconds()
      setRemainingSeconds((previousSeconds) =>
        previousSeconds === seconds ? previousSeconds : seconds,
      )
      return seconds
    }

    if (updateRemainingSeconds() <= 0) return

    const timer = window.setInterval(() => {
      if (updateRemainingSeconds() <= 0) {
        window.clearInterval(timer)
      }
    }, 250)

    return () => window.clearInterval(timer)
  }, [enabled, serverNow, timeoutAt])

  return {
    remainingSeconds,
    isTimeout: remainingSeconds <= 0,
  }
}
