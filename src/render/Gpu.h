#pragma once

#include <QString>
#include <QStringList>
#include <QVariantList>
#include <QtGui/qtguiglobal.h>

class QVulkanInstance;

// Qt may be Vulkan-enabled while this build machine has no Vulkan SDK
// (e.g. MinGW): QVulkanInstance is then an opaque pointer to us and the API
// probe can only check that an instance comes up.
#if QT_CONFIG(vulkan) && __has_include(<vulkan/vulkan.h>)
#define SCREENLET_VULKAN_SDK 1
#endif

// Graphics backend (QRhi API) and GPU selection.
//
// Both are read from Settings once, in main(), before the first QQuickWindow
// exists: Qt Quick fixes its graphics API per process, so a change applies
// after a restart. The same API drives the live preview and the offscreen
// export scene (Renderer).
namespace Gpu {

// Platform-specific choices for the "API gráfica" setting, auto first:
// [{ value, text, hint }].
QVariantList apis();

// "auto" | "high" | "low" — DXGI GPU preference on Windows.
// Detected adapters: [{ name, vendor, vramMb, integrated }].
QVariantList adapters();

// Applies `graphicsApi` / `gpuPreference` / `videoEncoder` from Settings.
// Probes the requested API first; when it can't start, falls back to the
// platform default and records why (status().note).
void applyAtStartup();

struct Status {
    QString requested;   // setting value
    QString active;      // value really in use ("auto" → resolved name)
    QString note;        // fallback reason, empty when all went as asked
    bool lowEnd = false; // old GPU (D3D feature level < 11_1): lighter UI effects
    QString gpuPreference; // values read at startup (restart detection)
    QString videoEncoder;
};
const Status &status();

// WARP, llvmpipe, GDI Generic…: the "GPU" is the processor.
bool isSoftwareRenderer(const QString &deviceName);

// Human name of the API in use (from the main window, once it renders).
QString apiLabel(const QString &value);

// Writes the per-app Windows GPU preference (Settings → Sistema → Tela →
// Gráficos) for this executable. "auto" removes it. No-op elsewhere.
void writeWindowsGpuPreference(const QString &pref);

// DXGI adapter index (EnumAdapters1 order) for a preference; -1 = default.
int adapterIndexFor(const QString &pref);

#if QT_CONFIG(vulkan)
QVulkanInstance *vulkanInstance(); // Qt's default instance; null without a driver
#endif

} // namespace Gpu
