import type { TransitionType } from "./channel";

export type ScheduleDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Dom...6=Sáb

export type ProgrammingSchedule =
  | { type: "always" }
  | { type: "time-range"; startTime: string; endTime: string }
  | { type: "day-of-week"; days: ScheduleDay[] };

export type ProgrammingRule = {
  id: string;
  assetFilename: string;    // filename in EXPORTS_DIR, e.g. "video.mp4"
  assetName: string;        // display name
  schedule: ProgrammingSchedule;
  transition?: TransitionType;
};
