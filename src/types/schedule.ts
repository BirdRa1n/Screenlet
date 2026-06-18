export type ScheduleItemType = "video" | "template" | "project";

export type ScheduleItem = {
  id: string;
  type: ScheduleItemType;
  startTime: string;
  duration: number;
  sourceId: string;
};

export type Schedule = {
  id: string;
  channelId: string;
  name: string;
  items: ScheduleItem[];
  createdAt: string;
  updatedAt: string;
};
