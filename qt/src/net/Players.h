#pragma once

#include "core/AppContext.h"

#include <QJSValue>
#include <QJsonObject>
#include <QObject>
#include <QVariantList>
#include <QtQml/qqmlregistration.h>

class QNetworkAccessManager;

// Screenlet Player devices (github.com/BirdRa1n/screenlet-player): discovered
// by heartbeat or LAN scan, claimed with POST /claim, then synced through the
// offline manifest served by Iptv.
class Players : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(Players)
    Q_PROPERTY(QVariantList items READ items NOTIFY itemsChanged)
    Q_PROPERTY(bool scanning READ scanning NOTIFY scanningChanged)

public:
    static constexpr int kControlPort = 8089;

    explicit Players(QObject *parent);

    QVariantList items() const;
    bool scanning() const { return m_scanning; }

    Q_INVOKABLE void scan(QJSValue callback);
    Q_INVOKABLE void claim(const QString &id, const QString &channelId, const QString &name, QJSValue callback);
    Q_INVOKABLE void unpair(const QString &id);
    Q_INVOKABLE void remove(const QString &id);

    void heartbeat(const QJsonObject &body, const QString &remoteIp);
    QJsonObject syncResponse(const QString &deviceId) const;

signals:
    void itemsChanged();
    void scanningChanged();

private:
    QList<QJsonObject> readRaw() const;
    void writeRaw(const QList<QJsonObject> &list);
    void upsertFound(const QJsonObject &identify, const QString &ip);

    QNetworkAccessManager *m_net = nullptr;
    bool m_scanning = false;
};
