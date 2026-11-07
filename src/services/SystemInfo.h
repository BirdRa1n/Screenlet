#pragma once

#include "core/AppContext.h"

#include <QObject>
#include <QVariantMap>
#include <QtQml/qqmlregistration.h>

class SystemInfo : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(SystemInfo)
    Q_PROPERTY(QString platform READ platform CONSTANT)
    Q_PROPERTY(QString appVersion READ appVersion CONSTANT)
    Q_PROPERTY(bool isMac READ isMac CONSTANT)
    Q_PROPERTY(bool isWindows READ isWindows CONSTANT)
    Q_PROPERTY(bool trayAvailable READ trayAvailable NOTIFY trayChanged)
    Q_PROPERTY(bool quitting READ quitting NOTIFY quittingChanged)
    Q_PROPERTY(bool startedHidden READ startedHidden CONSTANT)

public:
    bool trayAvailable() const { return m_tray; }
    void setTrayAvailable(bool v) { m_tray = v; emit trayChanged(); }
    bool quitting() const { return m_quitting; }
    bool startedHidden() const { return m_hidden; }
    void setStartedHidden(bool v) { m_hidden = v; }
    Q_INVOKABLE void quitApp();
    void requestShowWindow() { emit showWindowRequested(); }

signals:
    void trayChanged();
    void quittingChanged();
    void showWindowRequested();

private:
    bool m_tray = false;
    bool m_quitting = false;
    bool m_hidden = false;

public:
    explicit SystemInfo(QObject *parent);

    QString platform() const;
    QString appVersion() const;
    bool isMac() const;
    bool isWindows() const;

    Q_INVOKABLE QVariantMap info() const;
    Q_INVOKABLE int renderConcurrency() const;
    Q_INVOKABLE bool openExternal(const QString &url) const;   // http(s) only
    Q_INVOKABLE void revealFile(const QString &absolutePath) const;
    Q_INVOKABLE void openFolder(const QString &absolutePath) const;
    Q_INVOKABLE void copyText(const QString &text) const;
    Q_INVOKABLE void relaunch(int delayMs = 0);
    Q_INVOKABLE QString localPath(const QUrl &url) const;      // FileDialog result → path
    Q_INVOKABLE QString readTextFile(const QUrl &url) const;
    Q_INVOKABLE QString env(const QString &name) const { return qEnvironmentVariable(name.toUtf8().constData()); }
};
