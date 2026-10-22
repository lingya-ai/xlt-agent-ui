"use client"

import {useEffect, useRef, type RefObject} from "react"

import {init, type EChartsType} from "echarts/core"

import {registerECharts} from "../engine/echarts-core"
import type {WorkspaceChartOption} from "../engine/chart-option"
import type {ChartExportHandle, ResolvedChartTheme} from "../types/chart"

interface UseEChartsInput {
  active: boolean
  option: WorkspaceChartOption
  theme: ResolvedChartTheme
  onReady?: () => void
  onExportHandleChange?: (handle: ChartExportHandle | null) => void
  onError?: (error: Error) => void
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function hasSize(element: HTMLDivElement): boolean {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

/** 管理 ECharts Canvas 实例、尺寸监听、主题重建和销毁。 */
export function useECharts(input: UseEChartsInput): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<EChartsType | null>(null)
  const optionRef = useRef(input.option)
  const onReadyRef = useRef(input.onReady)
  const onExportHandleChangeRef = useRef(input.onExportHandleChange)
  const onErrorRef = useRef(input.onError)

  optionRef.current = input.option
  onReadyRef.current = input.onReady
  onExportHandleChangeRef.current = input.onExportHandleChange
  onErrorRef.current = input.onError

  useEffect(() => {
    const container = containerRef.current
    if (!container || !input.active) return

    let disposed = false
    let animationFrame: number | null = null

    const reportError = (error: unknown) => {
      if (!disposed) onErrorRef.current?.(toError(error))
    }

    const createInstance = () => {
      if (disposed || instanceRef.current || !hasSize(container)) return

      try {
        registerECharts()
        const instance = init(container, undefined, {renderer: "canvas"})
        instanceRef.current = instance
        instance.setOption(optionRef.current, {notMerge: true, lazyUpdate: true})
        onExportHandleChangeRef.current?.({
          getDataUrl: (options = {}) => {
            const currentInstance = instanceRef.current
            if (!currentInstance) throw new Error("图表实例尚未准备好，无法导出图片")

            return currentInstance.getDataURL({
              type: options.type ?? "png",
              pixelRatio: options.pixelRatio ?? 2,
              backgroundColor: options.backgroundColor ?? (input.theme === "dark" ? "#030712" : "#FFFFFF"),
            })
          },
        })
        onReadyRef.current?.()
      } catch (error) {
        const instance = instanceRef.current
        instanceRef.current = null
        onExportHandleChangeRef.current?.(null)
        instance?.off()
        instance?.dispose()
        reportError(error)
      }
    }

    const scheduleResize = () => {
      if (animationFrame != null) cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => {
        animationFrame = null
        createInstance()
        const instance = instanceRef.current
        if (!instance || disposed) return
        try {
          instance.resize()
        } catch (error) {
          reportError(error)
        }
      })
    }

    createInstance()
    const observer = new ResizeObserver(scheduleResize)
    observer.observe(container)

    return () => {
      disposed = true
      observer.disconnect()
      if (animationFrame != null) cancelAnimationFrame(animationFrame)
      const instance = instanceRef.current
      instanceRef.current = null
      onExportHandleChangeRef.current?.(null)
      if (instance) {
        instance.off()
        instance.dispose()
      }
    }
  }, [input.active, input.theme])

  useEffect(() => {
    const instance = instanceRef.current
    if (!input.active || !instance) return

    try {
      instance.setOption(input.option, {notMerge: true, lazyUpdate: true})
    } catch (error) {
      onErrorRef.current?.(toError(error))
    }
  }, [input.active, input.option])

  return containerRef
}
