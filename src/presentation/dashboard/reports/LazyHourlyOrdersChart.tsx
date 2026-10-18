"use client";

import dynamic from "next/dynamic";

import { ChartSkeleton } from "./ChartSkeleton";

/** `HourlyOrdersChart`, loaded client-side only behind a same-sized placeholder — see `LazyDailySalesChart`. */
export const LazyHourlyOrdersChart = dynamic(() => import("./HourlyOrdersChart").then((mod) => mod.HourlyOrdersChart), {
  ssr: false,
  loading: () => <ChartSkeleton height={180} />,
});
