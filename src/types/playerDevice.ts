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
  lastSeenAt: string | null;
  pairedAt: string | null;
  createdAt: string;
};
