"use client"

import type {BarChartProps} from "../types/chart"
import {CartesianChart} from "./cartesian-chart"

export function BarChart({orientation = "vertical", ...props}: BarChartProps) {
  return <CartesianChart {...props} orientation={orientation}/>
}

export type {BarChartProps} from "../types/chart"
