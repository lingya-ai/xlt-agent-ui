"use client"

import {useEffect, useState} from "react"

import type {ChartThemeMode, ResolvedChartTheme} from "../types/chart"

function resolveDocumentTheme(): ResolvedChartTheme {
  if (typeof document === "undefined") return "light"
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

/** 将 auto 主题解析为可直接传给 Canvas 的 light/dark。 */
export function useChartTheme(theme: ChartThemeMode): ResolvedChartTheme {
  const [documentTheme, setDocumentTheme] = useState<ResolvedChartTheme>(resolveDocumentTheme)

  useEffect(() => {
    if (theme !== "auto") return

    const root = document.documentElement
    const updateTheme = () => setDocumentTheme(resolveDocumentTheme())
    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(root, {attributes: true, attributeFilter: ["class"]})
    return () => observer.disconnect()
  }, [theme])

  return theme === "auto" ? documentTheme : theme
}
