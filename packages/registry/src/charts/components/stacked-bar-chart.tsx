"use client"

import type {StackedBarChartProps} from "../types/chart"
import {CartesianChart} from "./cartesian-chart"

export function StackedBarChart({orientation = "vertical", ...props}: StackedBarChartProps) {
  return <CartesianChart {...props} orientation={orientation}/>
}

export type {StackedBarChartProps} from "../types/chart"
