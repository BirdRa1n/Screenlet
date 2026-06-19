// A screenlet-player (github.com/BirdRa1n/screenlet-player) device.
// Unlike KodiDevice, these are never configured by an admin typing
// IP/SSH credentials — the player announces itself via heartbeat, and an
// admin claims it here once it shows up. See that repo's docs/PAIRING.md.
export type PlayerDevice = {
  id: string;
  deviceId: string;
  name: string;
  hostname: string;
  pairingCode: string;
  playerVersion: string;
  channelId: string | null;
  paired: boolean;
  playing: boolean;
  source: string | null;
  // Control-API address (http://ip:8089), learned from a heartbeat's
  // source address or from a network scan — null until either happens.
  apiUrl: string | null;
  // True once this device has been claimed (its API token is stored,
  // encrypted, in player-devices.json) — the token itself never reaches
  // the renderer, only this flag.
  hasApiToken: boolean;
  lastSeenAt: string | null;
  pairedAt: string | null;
  createdAt: string;
};
