import { db, type SlotLogRecord, type SlotStatus } from '../db';

export type { SlotLogRecord, SlotStatus };

export const slotLogId = (date: string, slotIndex: number): string => `${date}#${slotIndex}`;

export async function getSlotLog(date: string, slotIndex: number): Promise<SlotLogRecord | undefined> {
  return db.slotLog.get(slotLogId(date, slotIndex));
}

/** All logged slots for one IST date, in slot order. */
export async function listSlotLogForDate(date: string): Promise<SlotLogRecord[]> {
  const rows = await db.slotLog.where('date').equals(date).toArray();
  return rows.sort((a, b) => a.slotIndex - b.slotIndex);
}

/** All logged slots from one IST date to another (both included), in date then slot order. */
export async function listSlotLogBetween(from: string, to: string): Promise<SlotLogRecord[]> {
  if (from > to) return [];
  const rows = await db.slotLog.where('date').between(from, to, true, true).toArray();
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.slotIndex - b.slotIndex);
}

export async function setSlotStatus(
  date: string,
  slotIndex: number,
  status: SlotStatus,
  at: number = Date.now(),
): Promise<SlotLogRecord> {
  const rec: SlotLogRecord = { id: slotLogId(date, slotIndex), date, slotIndex, status, updatedAt: at };
  await db.slotLog.put(rec);
  return rec;
}

export async function clearSlotStatus(date: string, slotIndex: number): Promise<void> {
  await db.slotLog.delete(slotLogId(date, slotIndex));
}
