#pragma once

#include "core/AppContext.h"

#include <QObject>
#include <QtQml/qqmlregistration.h>

class QNetworkAccessManager;

// Checks GitHub Releases (prereleases included, like the Electron build) and
// offers the download page. Never downloads or installs silently.
class Updater : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(Updater)
    Q_PROPERTY(QString latestVersion READ latestVersion NOTIFY changed)
    Q_PROPERTY(QString releaseUrl READ releaseUrl NOTIFY changed)
    Q_PROPERTY(bool updateAvailable READ updateAvailable NOTIFY changed)

public:
    explicit Updater(QObject *parent);

    QString latestVersion() const { return m_latest; }
    QString releaseUrl() const { return m_url; }
    bool updateAvailable() const;

    Q_INVOKABLE void check(bool manual);
    Q_INVOKABLE void openRelease() const;

    static int compareVersions(const QString &a, const QString &b);

signals:
    void changed();
    void checked(bool manual, bool available);

private:
    QNetworkAccessManager *m_net = nullptr;
    QString m_latest;
    QString m_url;
};
