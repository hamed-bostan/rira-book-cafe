"use client";

import dynamic from "next/dynamic";

import { ChartSkeleton } from "./ChartSkeleton";

/**
 * `DailySalesChart`, loaded after the page is interactive. Recharts is the dashboard's
 * heaviest client module, and a chart can't measure its width on the server anyway,
 * so it renders client-side only behind a same-sized placeholder.
 */
export const LazyDailySalesChart = dynamic(() => import("./DailySalesChart").then((mod) => mod.DailySalesChart), {
  ssr: false,
  loading: () => <ChartSkeleton height={220} />,
});
