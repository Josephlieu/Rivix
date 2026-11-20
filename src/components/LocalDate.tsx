'use client';

import { useSyncExternalStore } from 'react';
import { formatDate, formatDateIn, formatDateTime } from '@/lib/format';

// A date in the viewer's own time zone, on a page the server draws first (2026-11-20: React error #418 on /rep/orders and the
// requests board). React needs the server's text and the browser's first render to be identical. Neither the viewer's zone
// nor Vancouver's works for that: the server has no viewer, and the server's and the browser's time-zone data can disagree
// (checked: for the same moment Node printed 9:00 p.m. Vancouver time and Chrome 10:00 p.m.). So the first render, on both
// sides, prints the date in UTC (no regional rules, the same everywhere), without a time; straight after, the browser shows
// the viewer's own date (and time).
const subscribe = () => () => {};

/** `time`: the date and the time ("Nov 20, 2026, 7:00 p.m."), as formatDateTime prints it, once the page is live. */
export default function LocalDate({ value, empty, time }: { value: string | number | Date | null | undefined; empty?: string; time?: boolean }) {
  const live = useSyncExternalStore(subscribe, () => true, () => false);
  if (!live) return <>{formatDateIn(value, 'UTC', empty)}</>;
  return <>{time ? formatDateTime(value, empty) : formatDate(value, empty)}</>;
}
