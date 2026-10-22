"use client"

import type {BarLineChartProps} from "../types/chart"
import {CartesianChart} from "./cartesian-chart"

export function BarLineChart({orientation = "vertical", ...props}: BarLineChartProps) {
  return <CartesianChart {...props} orientation={orientation}/>
}

export type {BarLineChartProps} from "../types/chart"
