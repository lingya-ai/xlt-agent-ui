'use client'
import {useCallback, useState} from 'react'

export interface PreviewState {
  zoom: number
  rotation: number
  currentPage: number
  totalPages: number
}

export interface UsePreviewStateResult extends PreviewState {
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  setRotation: (rotation: number) => void
  rotateLeft: () => void
  rotateRight: () => void
  setCurrentPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  setTotalPages: (total: number) => void
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const ZOOM_STEP = 0.2

/**
 * 预览器通用状态（缩放/旋转/页码）
 */
export function usePreviewState(initial: Partial<PreviewState> = {}): UsePreviewStateResult {
  const [zoom, setZoomState] = useState(initial.zoom ?? 1)
  const [rotation, setRotationState] = useState(initial.rotation ?? 0)
  const [currentPage, setCurrentPageState] = useState(initial.currentPage ?? 1)
  const [totalPages, setTotalPages] = useState(initial.totalPages ?? 1)

  const setZoom = useCallback((value: number) => {
    setZoomState(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2)))))
  }, [])

  const zoomIn = useCallback(() => setZoom(zoom + ZOOM_STEP), [zoom, setZoom])
  const zoomOut = useCallback(() => setZoom(zoom - ZOOM_STEP), [zoom, setZoom])
  const resetZoom = useCallback(() => setZoom(1), [setZoom])

  const setRotation = useCallback((value: number) => {
    // 标准化为 [0, 360)
    const normalized = ((value % 360) + 360) % 360
    setRotationState(normalized)
  }, [])

  const rotateLeft = useCallback(() => setRotation(rotation - 90), [rotation, setRotation])
  const rotateRight = useCallback(() => setRotation(rotation + 90), [rotation, setRotation])

  const setCurrentPage = useCallback((page: number) => {
    setCurrentPageState(Math.min(totalPages, Math.max(1, page)))
  }, [totalPages])

  const nextPage = useCallback(() => {
    setCurrentPageState((p) => Math.min(totalPages, p + 1))
  }, [totalPages])

  const prevPage = useCallback(() => {
    setCurrentPageState((p) => Math.max(1, p - 1))
  }, [])

  return {
    zoom,
    rotation,
    currentPage,
    totalPages,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    setRotation,
    rotateLeft,
    rotateRight,
    setCurrentPage,
    nextPage,
    prevPage,
    setTotalPages,
  }
}
