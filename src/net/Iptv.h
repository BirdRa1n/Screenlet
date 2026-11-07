#pragma once

#include "core/AppContext.h"

#include <QHash>
#include <QJsonObject>
#include <QMutex>
#include <QObject>
#include <QStringList>
#include <QtQml/qqmlregistration.h>

class HttpServer;
struct HttpRequest;
class HttpResponse;

// Built-in IPTV server (port 7095): M3U, XMLTV EPG, per-channel MPEG-TS
// stream (ffmpeg), range downloads of exports and the Screenlet Player API.
class Iptv : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(Iptv)
    Q_PROPERTY(bool running READ running NOTIFY statusChanged)
    Q_PROPERTY(int port READ port CONSTANT)
    Q_PROPERTY(QStringList ips READ ips NOTIFY statusChanged)
    Q_PROPERTY(QString selectedIp READ selectedIp NOTIFY statusChanged)
    Q_PROPERTY(bool ffmpegAvailable READ ffmpegAvailable NOTIFY statusChanged)
    Q_PROPERTY(QString lastError READ lastError NOTIFY statusChanged)

public:
    static constexpr int kPort = 7095;

    explicit Iptv(QObject *parent);

    bool running() const;
    int port() const { return kPort; }
    QStringList ips() const;
    QString selectedIp() const;
    bool ffmpegAvailable() const;
    QString lastError() const { return m_lastError; }

    Q_INVOKABLE bool start();
    Q_INVOKABLE void stop();
    Q_INVOKABLE void setIp(const QString &ip);
    Q_INVOKABLE void refreshStatus();
    Q_INVOKABLE QString baseUrl() const;

    static QStringList localIps();
    static QString findFfmpeg();

    // Manifest + hashes (used by the player sync route).
    QJsonObject channelManifest(const QJsonObject &channel) const;

signals:
    void statusChanged();

private:
    void handle(const HttpRequest &req, HttpResponse *res);
    void serveChannel(const QString &id, HttpResponse *res);
    QByteArray m3u() const;
    QByteArray epg() const;
    struct HashEntry { QString key; QString hash; qint64 size = 0; };
    HashEntry hashExport(const QString &filename) const;

    HttpServer *m_server = nullptr;
    QString m_lastError;
    QString m_ffmpeg;
    mutable QHash<QString, HashEntry> m_hashCache;
    mutable QMutex m_hashMutex;
};
