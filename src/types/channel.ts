export type Channel = {
  id: string;
  name: string;
  description: string;
  logo: string;
  enabled: boolean;
  loopSourceId: string | null;
  loopSourceType: "video" | null;
  createdAt: string;
  updatedAt: string;
};
