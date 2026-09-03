import { format, isSameDay, subDays } from 'date-fns'

import type { JournalEntry } from '../types'

export function computeCheckInStreak(entries: JournalEntry[]): number {
  if (!entries.length) return 0

  const dates = new Set(entries.map((entry) => format(new Date(entry.captured_at), 'yyyy-MM-dd')))
  let streak = 0
  let cursor = new Date()

  if (!dates.has(format(cursor, 'yyyy-MM-dd'))) {
    cursor = subDays(cursor, 1)
  }

  while (dates.has(format(cursor, 'yyyy-MM-dd'))) {
    streak += 1
    cursor = subDays(cursor, 1)
  }

  return streak
}

export function hasLoggedToday(entries: JournalEntry[]): boolean {
  const today = new Date()
  return entries.some((entry) => isSameDay(new Date(entry.captured_at), today))
}

export function countEntriesThisWeek(entries: JournalEntry[]): number {
  const weekAgo = subDays(new Date(), 7)
  return entries.filter((entry) => new Date(entry.captured_at) >= weekAgo).length
}
