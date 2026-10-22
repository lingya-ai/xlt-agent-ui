"use client"

import type {LineChartProps} from "../types/chart"
import {CartesianChart} from "./cartesian-chart"

export function LineChart({orientation = "vertical", ...props}: LineChartProps) {
  return <CartesianChart {...props} orientation={orientation}/>
}

export type {LineChartProps} from "../types/chart"
