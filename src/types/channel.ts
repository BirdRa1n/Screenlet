import type { ProgrammingRule } from "./programming";

export type TransitionType = "cut" | "fade";

export type PlaylistItem = {
  id: string;
  filename: string;
  name: string;
  transition: TransitionType;
};

export type Channel = {
  id: string;
  name: string;
  description: string;
  logo: string;
  enabled: boolean;
  playlist: PlaylistItem[];
  loop: boolean;
  rules?: ProgrammingRule[];  // optional time-based scheduling rules
  createdAt: string;
  updatedAt: string;
};
