#pragma once

#include "core/AppContext.h"

#include <QJsonObject>
#include <QObject>
#include <QtQml/qqmlregistration.h>

// userData/app-settings.json — same keys and defaults as the Electron build,
// plus `theme` (was localStorage in the renderer).
class Settings : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(Settings)

    Q_PROPERTY(bool launchAtLogin READ launchAtLogin WRITE setLaunchAtLogin NOTIFY changed)
    Q_PROPERTY(bool autoStartIptv READ autoStartIptv WRITE setAutoStartIptv NOTIFY changed)
    Q_PROPERTY(QString videoCodec READ videoCodec WRITE setVideoCodec NOTIFY changed)
    Q_PROPERTY(QString videoQuality READ videoQuality WRITE setVideoQuality NOTIFY changed)
    Q_PROPERTY(bool hardwareAcceleration READ hardwareAcceleration WRITE setHardwareAcceleration NOTIFY changed)
    Q_PROPERTY(bool termsAcknowledged READ termsAcknowledged WRITE setTermsAcknowledged NOTIFY changed)
    Q_PROPERTY(QString backupDir READ backupDir WRITE setBackupDir NOTIFY changed)
    Q_PROPERTY(QString theme READ theme WRITE setTheme NOTIFY changed)

public:
    explicit Settings(QObject *parent);

    bool launchAtLogin() const;
    bool autoStartIptv() const;
    QString videoCodec() const;
    QString videoQuality() const;
    bool hardwareAcceleration() const;
    bool termsAcknowledged() const;
    QString backupDir() const;
    QString theme() const;

    void setLaunchAtLogin(bool v);
    void setAutoStartIptv(bool v);
    void setVideoCodec(const QString &v);
    void setVideoQuality(const QString &v);
    void setHardwareAcceleration(bool v);
    void setTermsAcknowledged(bool v);
    void setBackupDir(const QString &v);
    void setTheme(const QString &v);

    // CRF the Electron build used; mapped to QMediaRecorder quality levels.
    int crf() const;

signals:
    void changed();

private:
    void set(const QString &key, const QJsonValue &v);
    void applyLoginItem();
    QJsonObject m_data;
};
