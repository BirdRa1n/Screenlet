export type KodiDevice = {
  id: string;
  name: string;
  ip: string;
  sshPort: number;
  sshUser: string;
  sshPassword: string;
  kodiHttpPort: number;
  kodiHttpUser: string;
  kodiHttpPassword: string;
  defaultChannelId: string | null;
  kodiChannelId: number | null;
  restartDelaySecs: number;
  createdAt: string;
  updatedAt: string;
};

export type KodiPingResult =
  | { ok: true; version: string }
  | { ok: false; error: string };

export type KodiChannel = {
  channelid: number;
  label: string;
};
