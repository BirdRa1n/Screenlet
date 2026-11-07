#pragma once

#include <QByteArray>
#include <QHash>
#include <QHostAddress>
#include <QObject>
#include <QPointer>
#include <QTcpServer>
#include <QUrlQuery>

#include <functional>

class QFile;
class QProcess;
class QTcpSocket;

// Minimal HTTP/1.1 server (Qt HttpServer isn't part of the installed kit).
// One request per connection ("Connection: close") — enough for M3U/EPG,
// JSON APIs, Range file downloads and long-lived MPEG-TS streams.
struct HttpRequest {
    QByteArray method;
    QString path;          // decoded, without query
    QUrlQuery query;
    QHash<QByteArray, QByteArray> headers; // lower-case keys
    QByteArray body;
    QHostAddress remote;
};

class HttpResponse : public QObject
{
    Q_OBJECT
public:
    explicit HttpResponse(QTcpSocket *socket, bool head);

    void send(int status, const QByteArray &contentType, const QByteArray &body,
              const QList<QPair<QByteArray, QByteArray>> &extraHeaders = {});
    void sendJson(int status, const QByteArray &json);
    void sendText(int status, const QString &text);
    // Serves a file with Range support, streamed in 256 KB chunks.
    void sendFile(const QString &path, const QByteArray &mime, const QByteArray &rangeHeader);
    // Pipes a process's stdout to the socket until either side ends.
    void streamProcess(QProcess *process, const QByteArray &mime);

    bool isOpen() const;

signals:
    void closed();

private:
    void writeHead(int status, const QList<QPair<QByteArray, QByteArray>> &headers);
    void pumpFile();
    void finish();

    QPointer<QTcpSocket> m_socket;
    bool m_head = false;
    QFile *m_file = nullptr;
    qint64 m_remaining = 0;
};

class HttpServer : public QObject
{
    Q_OBJECT
public:
    using Handler = std::function<void(const HttpRequest &, HttpResponse *)>;

    explicit HttpServer(Handler handler, QObject *parent = nullptr);

    bool listen(quint16 port, QString *error = nullptr);
    void close();
    bool isListening() const;

private:
    void onConnection();
    QTcpServer m_server;
    Handler m_handler;
};
