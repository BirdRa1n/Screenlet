// KodiDevice as seen by the renderer.
// Passwords are NEVER returned from device-list — only boolean flags indicating
// whether a credential is stored. Plain passwords are only present when the user
// is actively entering them in the form (before saving); they are encrypted by
// the main process (safeStorage) and never sent back to the renderer.
export type KodiDevice = {
  id: string;
  name: string;
  ip: string;
  sshPort: number;
  sshUser: string;
  // Present only when being submitted for save. Never returned by device-list.
  sshPassword?: string;
  hasSshPassword: boolean;
  kodiHttpPort: number;
  kodiHttpUser: string;
  // Present only when being submitted for save. Never returned by device-list.
  kodiHttpPassword?: string;
  hasKodiPassword: boolean;
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

// Credentials passed from the form to test a not-yet-saved device.
export type KodiTestCreds = {
  ip: string;
  kodiHttpPort: number;
  kodiHttpUser: string;
  kodiHttpPassword: string;
};

// SSH credentials for fetching Kodi config before the device is saved.
export type SshTestCreds = {
  ip: string;
  sshPort: number;
  sshUser: string;
  sshPassword: string;
};

export type KodiFetchConfigResult =
  | { ok: true; port: number; user: string; password: string; authEnabled: boolean }
  | { ok: false; error: string };
