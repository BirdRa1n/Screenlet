#pragma once

#include <QString>

// Every on-disk location the app uses. Locations are resolved once at
// startup: changing the storage folder relaunches the app (same contract as
// the Electron version), so nothing caches a stale path.
//
// userData deliberately matches Electron's `app.getPath("userData")` so the
// Qt build reads the settings/devices the Electron build already wrote:
//   macOS   ~/Library/Application Support/Screenlet
//   Windows %APPDATA%/Screenlet
//   Linux   $XDG_CONFIG_HOME/Screenlet (~/.config/Screenlet)
namespace Paths {

void init();

QString userData();          // machine-local config (never synced)
QString base();              // SCREENLET_DIR (user-chosen, may be synced)
QString uploads();           // base/assets   ("uploads/<file>" in JSON)
QString projects();
QString projectThumbs();
QString templates();
QString library();
QString channels();
QString schedules();         // legacy, EPG only
QString exports();
QString defaultBackups();

QString storageConfigFile();
QString appSettingsFile();
QString iptvConfigFile();
QString devicesFile();
QString integrationsFile();
QString storeProfilesFile();
QString playerDevicesFile();
QString mediaCatalogFile();

QString defaultBase();

// Resolves a stored relative media path to an absolute file path:
//   "uploads/x.png"          → <base>/assets/x.png
//   "exports/x.mp4"          → <base>/exports/x.mp4
//   "project-thumbs/x.jpg"   → <base>/project-thumbs/x.jpg
//   "assets/products/x.png"  → ":/qt/qml/Screenlet/resources/assets/products/x.png" (bundled)
QString resolveMedia(const QString &stored);

// Same, as a URL string usable by QML Image/MediaPlayer ("file://" or "qrc:").
QString mediaUrl(const QString &stored);

// Keeps only a safe basename (no separators / traversal).
QString safeName(const QString &name);

bool ensureDir(const QString &dir);

} // namespace Paths
