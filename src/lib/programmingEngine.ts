import type { Channel } from "../types/channel";
import type { ProgrammingRule, ProgrammingSchedule } from "../types/programming";

function timeToMinutes(hhmm: string): number {
  const [h = "0", m = "0"] = hhmm.split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

function matchesSchedule(schedule: ProgrammingSchedule, now: Date): boolean {
  if (schedule.type === "always") return true;

  const dayOfWeek = now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (schedule.type === "day-of-week") {
    return schedule.days.includes(dayOfWeek);
  }

  if (schedule.type === "time-range") {
    const start = timeToMinutes(schedule.startTime);
    const end = timeToMinutes(schedule.endTime);
    if (start <= end) return currentMinutes >= start && currentMinutes <= end;
    // Overnight range (e.g. 22:00–06:00)
    return currentMinutes >= start || currentMinutes <= end;
  }

  return false;
}

/**
 * Pure function — safe to call in both renderer and main.cjs.
 * Returns the filename to broadcast for `channel` at `now`.
 * Falls back to the first playlist item if no rule matches.
 */
export function getCurrentAsset(channel: Channel, now: Date = new Date()): string | null {
  const rules: ProgrammingRule[] = channel.rules ?? [];
  const matched = rules.find((r) => matchesSchedule(r.schedule, now));
  if (matched) return matched.assetFilename;

  const first = channel.playlist?.[0];
  return first ? first.filename : null;
}
