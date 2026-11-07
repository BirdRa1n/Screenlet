#include "Settings.h"

#include "core/JsonIo.h"
#include "core/Paths.h"

#include <QCoreApplication>
#include <QDir>
#include <QFile>
#include <QSettings>

namespace {
QJsonObject defaults()
{
    return {
        {QStringLiteral("launchAtLogin"), false},
        {QStringLiteral("autoStartIptvOnLaunch"), true},
        {QStringLiteral("videoCodec"), QStringLiteral("h264")},
        {QStringLiteral("videoQuality"), QStringLiteral("medium")},
        {QStringLiteral("hardwareAcceleration"), true},
        {QStringLiteral("termsAcknowledged"), false},
        {QStringLiteral("backupDir"), QString()},
        {QStringLiteral("theme"), QStringLiteral("light")},
    };
}
} // namespace

Settings::Settings(QObject *parent)
    : QObject(parent)
{
    registerInstance();
    m_data = defaults();
    const QJsonObject stored = JsonIo::readObject(Paths::appSettingsFile());
    for (auto it = stored.begin(); it != stored.end(); ++it)
        m_data.insert(it.key(), it.value());
}

bool Settings::launchAtLogin() const { return m_data.value(QStringLiteral("launchAtLogin")).toBool(); }
bool Settings::autoStartIptv() const { return m_data.value(QStringLiteral("autoStartIptvOnLaunch")).toBool(); }
QString Settings::videoCodec() const { return m_data.value(QStringLiteral("videoCodec")).toString(); }
QString Settings::videoQuality() const { return m_data.value(QStringLiteral("videoQuality")).toString(); }
bool Settings::hardwareAcceleration() const { return m_data.value(QStringLiteral("hardwareAcceleration")).toBool(); }
bool Settings::termsAcknowledged() const { return m_data.value(QStringLiteral("termsAcknowledged")).toBool(); }
QString Settings::backupDir() const { return m_data.value(QStringLiteral("backupDir")).toString(); }
QString Settings::theme() const { return m_data.value(QStringLiteral("theme")).toString(); }

void Settings::set(const QString &key, const QJsonValue &v)
{
    if (m_data.value(key) == v)
        return;
    m_data.insert(key, v);
    JsonIo::write(Paths::appSettingsFile(), m_data);
    emit changed();
}

void Settings::setLaunchAtLogin(bool v)
{
    set(QStringLiteral("launchAtLogin"), v);
    applyLoginItem();
}
void Settings::setAutoStartIptv(bool v) { set(QStringLiteral("autoStartIptvOnLaunch"), v); }
void Settings::setVideoCodec(const QString &v)
{
    if (v == QLatin1String("h264") || v == QLatin1String("h265"))
        set(QStringLiteral("videoCodec"), v);
}
void Settings::setVideoQuality(const QString &v)
{
    if (v == QLatin1String("high") || v == QLatin1String("medium") || v == QLatin1String("low"))
        set(QStringLiteral("videoQuality"), v);
}
void Settings::setHardwareAcceleration(bool v) { set(QStringLiteral("hardwareAcceleration"), v); }
void Settings::setTermsAcknowledged(bool v) { set(QStringLiteral("termsAcknowledged"), v); }
void Settings::setBackupDir(const QString &v) { set(QStringLiteral("backupDir"), v); }
void Settings::setTheme(const QString &v)
{
    if (v == QLatin1String("light") || v == QLatin1String("dark") || v == QLatin1String("system"))
        set(QStringLiteral("theme"), v);
}

int Settings::crf() const
{
    const bool h265 = videoCodec() == QLatin1String("h265");
    const QString q = videoQuality();
    if (q == QLatin1String("high"))
        return h265 ? 24 : 18;
    if (q == QLatin1String("low"))
        return h265 ? 33 : 28;
    return h265 ? 28 : 23;
}

// Registers/unregisters "start at login" with the --hidden flag (opens
// straight to the tray). Only meaningful from an installed build.
void Settings::applyLoginItem()
{
    const bool on = launchAtLogin();
    const QString exe = QCoreApplication::applicationFilePath();
#if defined(Q_OS_MACOS)
    const QString plist = QDir::homePath() + QStringLiteral("/Library/LaunchAgents/com.screenlet.app.plist");
    if (!on) {
        QFile::remove(plist);
        return;
    }
    QDir().mkpath(QDir::homePath() + QStringLiteral("/Library/LaunchAgents"));
    QFile f(plist);
    if (f.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        f.write(QStringLiteral(
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                    "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n"
                    "<plist version=\"1.0\"><dict>\n"
                    "<key>Label</key><string>com.screenlet.app</string>\n"
                    "<key>ProgramArguments</key><array><string>%1</string><string>--hidden</string></array>\n"
                    "<key>RunAtLoad</key><true/>\n"
                    "</dict></plist>\n")
                    .arg(exe.toHtmlEscaped())
                    .toUtf8());
    }
#elif defined(Q_OS_WIN)
    QSettings run(QStringLiteral("HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"),
                  QSettings::NativeFormat);
    if (on)
        run.setValue(QStringLiteral("Screenlet"), QStringLiteral("\"%1\" --hidden").arg(QDir::toNativeSeparators(exe)));
    else
        run.remove(QStringLiteral("Screenlet"));
#else
    const QString dir = QDir::homePath() + QStringLiteral("/.config/autostart");
    const QString file = dir + QStringLiteral("/screenlet.desktop");
    if (!on) {
        QFile::remove(file);
        return;
    }
    QDir().mkpath(dir);
    QFile f(file);
    if (f.open(QIODevice::WriteOnly | QIODevice::Truncate))
        f.write(QStringLiteral("[Desktop Entry]\nType=Application\nName=Screenlet\nExec=\"%1\" --hidden\n").arg(exe).toUtf8());
#endif
}
