import { getAvailableDates, getSchedulesRange } from '@/lib/db';
import ScheduleDashboard from '@/components/ScheduleDashboard';
import { Center, Title } from '@mantine/core';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string, start?: string, end?: string }> }) {
  const availableDates = await getAvailableDates();
  const { date, start, end } = await searchParams;

  console.log('Page SearchParams:', { date, start, end });

  // Default logic:
  // If date param exists, use it.
  // Else if available availableDates, search for "today" in them.
  // If not found, use the last Available Date.

  const todayRaw = new Date();
  const todayStr = dayjs(todayRaw).format('YYYY/MM/DD');

  let anchorDate = date;
  if (!anchorDate) {
    anchorDate = availableDates.includes(todayStr) ? todayStr : (availableDates.length > 0 ? availableDates[availableDates.length - 1] : todayStr);
  }

  // Calculate Week Range (Mon - Sun) for Tab 2
  const anchor = dayjs(anchorDate?.replace(/\//g, '-') || new Date());
  const dayIndex = anchor.day();
  const diffToMon = dayIndex === 0 ? -6 : 1 - dayIndex;

  const monday = anchor.add(diffToMon, 'day');
  const sunday = monday.add(6, 'day');

  const weekStartStr = monday.format('YYYY/MM/DD');
  const weekEndStr = sunday.format('YYYY/MM/DD');

  // Determine Fetch Range
  // If start and end are provided (Tab 1 Range Mode), fetch that range.
  // Else fetch the week range (Tab 2 Default Mode).
  // Note: ScheduleDashboard will receive data.
  // We want to fetch the "Union" if possible, or just the requested range.
  // If user requested a custom range, we return that. Tab 2 might show partial data if the custom range doesn't cover the full week.
  // But usually user selects range for Pivot.

  let fetchStart = weekStartStr;
  let fetchEnd = weekEndStr;

  if (start && end) {
    fetchStart = start;
    fetchEnd = end;
  }

  const schedules = await getSchedulesRange(fetchStart, fetchEnd);

  return (
    <ScheduleDashboard
      schedules={schedules}
      availableDates={availableDates}
      currentDate={anchorDate || '2025/11/27'}
      weekRange={{ start: weekStartStr, end: weekEndStr }}
      viewRange={{ start: fetchStart, end: fetchEnd }}
    />
  );
}
