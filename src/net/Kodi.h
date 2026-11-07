#pragma once

#include "core/AppContext.h"

#include <QJSValue>
#include <QJsonObject>
#include <QObject>
#include <QVariantList>
#include <QtQml/qqmlregistration.h>

#include <functional>

class QNetworkAccessManager;

// Kodi / LibreELEC boxes: SSH (system `ssh` + askpass helper) for restarts
// and config discovery, JSON-RPC over HTTP for ping/channels/open.
//
// Passwords are stored through SecretStore and never cross into QML; QML
// only sees hasSshPassword / hasKodiPassword / needsReauth.
class Kodi : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(Kodi)
    Q_PROPERTY(QVariantList items READ items NOTIFY itemsChanged)

public:
    explicit Kodi(QObject *parent);

    QVariantList items() const;

    // device may carry sshPassword / kodiHttpPassword in plain text (from the
    // form). Empty = keep the stored secret.
    Q_INVOKABLE void save(const QVariantMap &device);
    Q_INVOKABLE void remove(const QString &id);
    Q_INVOKABLE QVariantMap blank() const;

    Q_INVOKABLE void ping(const QString &id, QJSValue callback);
    Q_INVOKABLE void restartAndOpen(const QString &id, QJSValue callback);
    // Temporary creds from the form (device not saved yet).
    Q_INVOKABLE void listChannels(const QVariantMap &creds, QJSValue callback);
    Q_INVOKABLE void fetchConfig(const QVariantMap &sshCreds, QJSValue callback);

    void restartForChannel(const QString &channelId);

signals:
    void itemsChanged();

private:
    struct Device {
        QJsonObject raw;
        QString sshPassword;
        QString kodiPassword;
    };
    QList<QJsonObject> readRaw() const;
    void writeRaw(const QList<QJsonObject> &list);
    Device withSecrets(const QString &id) const;

    void rpc(const QString &ip, int port, const QString &user, const QString &pass, const QString &method,
             const QJsonObject &params, std::function<void(bool, QJsonObject, QString)> done);
    void ssh(const QString &ip, int port, const QString &user, const QString &pass, const QString &command,
             bool tolerant, std::function<void(bool, QString)> done);
    void doRestartAndOpen(const Device &d, std::function<void(bool, QString)> done);

    QNetworkAccessManager *m_net = nullptr;
};
