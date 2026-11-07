#include "Paths.h"

#include "JsonIo.h"

#include <QDir>
#include <QFileInfo>
#include <QStandardPaths>
#include <QUrl>

namespace {
QString g_userData;
QString g_base;

QString join(const QString &a, const QString &b) { return QDir(a).filePath(b); }
} // namespace

namespace Paths {

void init()
{
#if defined(Q_OS_MACOS)
    g_userData = QDir::homePath() + QStringLiteral("/Library/Application Support/Screenlet");
#elif defined(Q_OS_WIN)
    const QString appData = qEnvironmentVariable("APPDATA");
    g_userData = (appData.isEmpty() ? QDir::homePath() : appData) + QStringLiteral("/Screenlet");
#else
    QString xdg = qEnvironmentVariable("XDG_CONFIG_HOME");
    if (xdg.isEmpty())
        xdg = QDir::homePath() + QStringLiteral("/.config");
    g_userData = xdg + QStringLiteral("/Screenlet");
#endif
    // Dev/test isolation: point both locations somewhere disposable.
    if (qEnvironmentVariableIsSet("SCREENLET_USERDATA_DIR"))
        g_userData = qEnvironmentVariable("SCREENLET_USERDATA_DIR");
    ensureDir(g_userData);

    g_base = defaultBase();
    const QJsonObject cfg = JsonIo::readObject(storageConfigFile());
    const QString custom = cfg.value(QStringLiteral("baseDir")).toString();
    if (!custom.isEmpty())
        g_base = custom;
    if (qEnvironmentVariableIsSet("SCREENLET_DATA_DIR"))
        g_base = qEnvironmentVariable("SCREENLET_DATA_DIR");

    for (const QString &d : {base(), uploads(), projects(), exports(), templates(), library(), channels()})
        ensureDir(d);
}

QString defaultBase()
{
    QString docs = QStandardPaths::writableLocation(QStandardPaths::DocumentsLocation);
    if (docs.isEmpty())
        docs = QDir::homePath() + QStringLiteral("/Documents");
    return join(docs, QStringLiteral("Screenlet"));
}

QString userData() { return g_userData; }
QString base() { return g_base; }
QString uploads() { return join(g_base, QStringLiteral("assets")); }
QString projects() { return join(g_base, QStringLiteral("projects")); }
QString projectThumbs() { return join(g_base, QStringLiteral("project-thumbs")); }
QString templates() { return join(g_base, QStringLiteral("templates")); }
QString library() { return join(g_base, QStringLiteral("library")); }
QString channels() { return join(g_base, QStringLiteral("channels")); }
QString schedules() { return join(g_base, QStringLiteral("schedules")); }
QString exports() { return join(g_base, QStringLiteral("exports")); }
QString defaultBackups() { return join(g_base, QStringLiteral("backups")); }

QString storageConfigFile() { return join(g_userData, QStringLiteral("storage-config.json")); }
QString appSettingsFile() { return join(g_userData, QStringLiteral("app-settings.json")); }
QString iptvConfigFile() { return join(g_userData, QStringLiteral("iptv-config.json")); }
QString devicesFile() { return join(g_userData, QStringLiteral("devices.json")); }
QString integrationsFile() { return join(g_userData, QStringLiteral("integrations.json")); }
QString storeProfilesFile() { return join(g_userData, QStringLiteral("store-profiles.json")); }
// Moved to userData (was in the synced folder): the claim token is bound to
// this machine, so a synced copy only lets two stores clobber each other.
QString playerDevicesFile() { return join(g_userData, QStringLiteral("player-devices.json")); }
QString mediaCatalogFile() { return join(uploads(), QStringLiteral("media-catalog.json")); }

QString safeName(const QString &name)
{
    QString n = QFileInfo(name).fileName();
    if (n == QLatin1String(".") || n == QLatin1String(".."))
        return {};
    return n;
}

QString resolveMedia(const QString &stored)
{
    if (stored.isEmpty())
        return {};
    QString s = stored;
    if (s.startsWith(QLatin1Char('/')) && !QFileInfo::exists(s))
        s.remove(0, 1);
    if (s.startsWith(QLatin1String("uploads/")))
        return join(uploads(), safeName(s.mid(8)));
    if (s.startsWith(QLatin1String("exports/")))
        return join(exports(), safeName(s.mid(8)));
    if (s.startsWith(QLatin1String("project-thumbs/")))
        return join(projectThumbs(), safeName(s.mid(15)));
    if (s.startsWith(QLatin1String("assets/")))
        return QStringLiteral(":/qt/qml/Screenlet/resources/") + s;
    if (QFileInfo(s).isAbsolute())
        return s;
    return join(g_base, s);
}

QString mediaUrl(const QString &stored)
{
    if (stored.isEmpty())
        return {};
    if (stored.startsWith(QLatin1String("http://")) || stored.startsWith(QLatin1String("https://"))
        || stored.startsWith(QLatin1String("qrc:")) || stored.startsWith(QLatin1String("file:"))
        || stored.startsWith(QLatin1String("data:")))
        return stored;
    const QString p = resolveMedia(stored);
    if (p.startsWith(QLatin1Char(':')))
        return QStringLiteral("qrc") + p;
    return QUrl::fromLocalFile(p).toString();
}

bool ensureDir(const QString &dir)
{
    return QDir().mkpath(dir);
}

} // namespace Paths
