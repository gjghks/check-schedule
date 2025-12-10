import { getAvailableDates, getSchedulesRange } from '@/lib/db';
import ScheduleDashboard from '@/components/ScheduleDashboard';
import { Center, Title } from '@mantine/core';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const availableDates = await getAvailableDates();
  const { date } = await searchParams;

  console.log('Page SearchParams:', { date });

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

  console.log('Anchor Date:', anchorDate);

  // Calculate Week Range (Mon - Sun)
  // Note: Data format is YYYY/MM/DD.
  const anchor = dayjs(anchorDate?.replace(/\//g, '-') || new Date()); // format to YYYY-MM-DD for dayjs parsing

  // Calculate Monday and Sunday
  // Dayjs .day(1) is Monday, .day(0) is Sunday of *current* week?
  // dayjs().day(1) sets to Monday of this week.
  // Exception: if today is Sunday (day 0), and we want "Mon-Sun" where Sunday is the *end*.
  // dayjs considers Sunday as day 0 (start of week) in some locales, or end in others.
  // 'ko' locale: Monday is start.

  // Force "Monday" as start.
  // dayjs().day(1) is Monday.
  // If today is Sunday (0), we need previous Monday (-6 days).
  // If today is Monday (1), we need today (0 days).
  const dayIndex = anchor.day();
  const diffToMon = dayIndex === 0 ? -6 : 1 - dayIndex;

  const monday = anchor.add(diffToMon, 'day');
  const sunday = monday.add(6, 'day');

  const startDateStr = monday.format('YYYY/MM/DD');
  const endDateStr = sunday.format('YYYY/MM/DD');

  const schedules = await getSchedulesRange(startDateStr, endDateStr);

  return (
    <ScheduleDashboard
      schedules={schedules}
      availableDates={availableDates}
      currentDate={anchorDate || '2025/11/27'}
      weekRange={{ start: startDateStr, end: endDateStr }}
    />
  );
}
