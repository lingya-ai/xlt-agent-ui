"use client"

import {useEffect, useState} from "react"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

function getInitialPreference(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(REDUCED_MOTION_QUERY).matches
    : false
}

/** 读取系统减少动态效果偏好，并兼容旧版 MediaQueryList 监听接口。 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(getInitialPreference)

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY)
    const handleChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches)
    setReducedMotion(mediaQuery.matches)

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  return reducedMotion
}
