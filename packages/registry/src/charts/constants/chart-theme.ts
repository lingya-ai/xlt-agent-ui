import type {ResolvedChartTheme} from "../types/chart"

export interface ChartThemeTokens {
  palette: readonly string[]
  text: string
  mutedText: string
  axis: string
  splitLine: string
  tooltipBackground: string
  tooltipBorder: string
}

const LIGHT_PALETTE = [
  "#2563EB",
  "#D97706",
  "#059669",
  "#DC2626",
  "#7C3AED",
  "#0891B2",
  "#C2410C",
  "#4F46E5",
  "#65A30D",
  "#BE185D",
  "#0F766E",
  "#9333EA",
] as const

const DARK_PALETTE = [
  "#60A5FA",
  "#FBBF24",
  "#34D399",
  "#F87171",
  "#A78BFA",
  "#22D3EE",
  "#FB923C",
  "#818CF8",
  "#A3E635",
  "#F472B6",
  "#2DD4BF",
  "#C084FC",
] as const

export const CHART_THEMES: Record<ResolvedChartTheme, ChartThemeTokens> = {
  light: {
    palette: LIGHT_PALETTE,
    text: "#111827",
    mutedText: "#4B5563",
    axis: "#9CA3AF",
    splitLine: "#E5E7EB",
    tooltipBackground: "#FFFFFF",
    tooltipBorder: "#D1D5DB",
  },
  dark: {
    palette: DARK_PALETTE,
    text: "#F9FAFB",
    mutedText: "#D1D5DB",
    axis: "#6B7280",
    splitLine: "#374151",
    tooltipBackground: "#111827",
    tooltipBorder: "#4B5563",
  },
}

export const DEFAULT_CHART_HEIGHT = 360
export const DEFAULT_ANIMATION_POINT_THRESHOLD = 1000
export const DEFAULT_DATA_ZOOM_CATEGORY_THRESHOLD = 20
