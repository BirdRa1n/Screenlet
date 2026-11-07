#include "HttpServer.h"

#include <QFile>
#include <QProcess>
#include <QRegularExpression>
#include <QTcpSocket>
#include <QTimer>
#include <QUrl>

namespace {
constexpr qint64 kChunk = 256 * 1024;
constexpr int kMaxHeader = 64 * 1024;
constexpr qint64 kMaxBody = 4 * 1024 * 1024;

QByteArray reason(int status)
{
    switch (status) {
    case 200: return "OK";
    case 204: return "No Content";
    case 206: return "Partial Content";
    case 400: return "Bad Request";
    case 403: return "Forbidden";
    case 404: return "Not Found";
    case 405: return "Method Not Allowed";
    case 413: return "Payload Too Large";
    case 416: return "Range Not Satisfiable";
    case 500: return "Internal Server Error";
    case 503: return "Service Unavailable";
    default: return "Status";
    }
}

// Per-connection request parser; owned by the socket.
class Connection : public QObject
{
public:
    Connection(QTcpSocket *socket, HttpServer::Handler handler)
        : QObject(socket), m_socket(socket), m_handler(std::move(handler))
    {
        connect(socket, &QTcpSocket::readyRead, this, [this] { onRead(); });
        // Idle/slowloris guard: a request must arrive within 15 s.
        QTimer::singleShot(15000, this, [this] {
            if (!m_dispatched && m_socket)
                m_socket->abort();
        });
    }

private:
    void onRead()
    {
        if (m_dispatched)
            return;
        m_buffer += m_socket->readAll();
        if (m_headerEnd < 0) {
            m_headerEnd = int(m_buffer.indexOf("\r\n\r\n"));
            if (m_headerEnd < 0) {
                if (m_buffer.size() > kMaxHeader)
                    m_socket->abort();
                return;
            }
            parseHead(m_buffer.left(m_headerEnd));
        }
        const qint64 need = m_req.headers.value("content-length").toLongLong();
        if (need > kMaxBody) {
            auto *res = new HttpResponse(m_socket, false);
            res->sendText(413, QStringLiteral("too large"));
            m_dispatched = true;
            return;
        }
        if (m_buffer.size() - (m_headerEnd + 4) < need)
            return;
        m_req.body = m_buffer.mid(m_headerEnd + 4, need);
        m_dispatched = true;
        auto *res = new HttpResponse(m_socket, m_req.method == "HEAD");
        m_handler(m_req, res);
    }

    void parseHead(const QByteArray &head)
    {
        const QList<QByteArray> lines = head.split('\n');
        const QList<QByteArray> first = lines.value(0).trimmed().split(' ');
        m_req.method = first.value(0).toUpper();
        const QUrl url(QString::fromLatin1(first.value(1)));
        m_req.path = url.path(QUrl::FullyDecoded);
        m_req.query = QUrlQuery(url.query());
        for (int i = 1; i < lines.size(); ++i) {
            const QByteArray line = lines.at(i).trimmed();
            const int colon = int(line.indexOf(':'));
            if (colon > 0)
                m_req.headers.insert(line.left(colon).trimmed().toLower(), line.mid(colon + 1).trimmed());
        }
        m_req.remote = m_socket->peerAddress();
    }

    QTcpSocket *m_socket;
    HttpServer::Handler m_handler;
    QByteArray m_buffer;
    int m_headerEnd = -1;
    bool m_dispatched = false;
    HttpRequest m_req;
};
} // namespace

// ── HttpResponse ──────────────────────────────────────────────────────────────

HttpResponse::HttpResponse(QTcpSocket *socket, bool head)
    : QObject(socket), m_socket(socket), m_head(head)
{
    connect(socket, &QTcpSocket::disconnected, this, [this] {
        emit closed();
        deleteLater();
    });
}

bool HttpResponse::isOpen() const { return m_socket && m_socket->state() == QAbstractSocket::ConnectedState; }

void HttpResponse::writeHead(int status, const QList<QPair<QByteArray, QByteArray>> &headers)
{
    if (!m_socket)
        return;
    QByteArray out = "HTTP/1.1 " + QByteArray::number(status) + ' ' + reason(status) + "\r\n";
    out += "Access-Control-Allow-Origin: *\r\nConnection: close\r\nServer: Screenlet\r\n";
    for (const auto &h : headers)
        out += h.first + ": " + h.second + "\r\n";
    out += "\r\n";
    m_socket->write(out);
}

void HttpResponse::finish()
{
    if (m_socket)
        m_socket->disconnectFromHost();
}

void HttpResponse::send(int status, const QByteArray &contentType, const QByteArray &body,
                        const QList<QPair<QByteArray, QByteArray>> &extraHeaders)
{
    QList<QPair<QByteArray, QByteArray>> h = extraHeaders;
    if (!contentType.isEmpty())
        h.append({"Content-Type", contentType});
    h.append({"Content-Length", QByteArray::number(body.size())});
    writeHead(status, h);
    if (!m_head && m_socket)
        m_socket->write(body);
    finish();
}

void HttpResponse::sendJson(int status, const QByteArray &json) { send(status, "application/json", json); }
void HttpResponse::sendText(int status, const QString &text) { send(status, "text/plain; charset=utf-8", text.toUtf8()); }

void HttpResponse::sendFile(const QString &path, const QByteArray &mime, const QByteArray &rangeHeader)
{
    auto *file = new QFile(path, this);
    if (!file->open(QIODevice::ReadOnly)) {
        sendText(404, QStringLiteral("not found"));
        return;
    }
    const qint64 size = file->size();
    qint64 start = 0;
    qint64 end = size - 1;
    int status = 200;
    if (!rangeHeader.isEmpty()) {
        static const QRegularExpression re(QStringLiteral("bytes=(\\d*)-(\\d*)"));
        const auto m = re.match(QString::fromLatin1(rangeHeader));
        if (m.hasMatch()) {
            if (!m.captured(1).isEmpty())
                start = m.captured(1).toLongLong();
            if (!m.captured(2).isEmpty())
                end = m.captured(2).toLongLong();
            if (m.captured(1).isEmpty() && !m.captured(2).isEmpty()) { // suffix range
                start = std::max<qint64>(0, size - m.captured(2).toLongLong());
                end = size - 1;
            }
            if (start >= size || end >= size || start > end) {
                writeHead(416, {{"Content-Range", "bytes */" + QByteArray::number(size)}});
                finish();
                return;
            }
            status = 206;
        }
    }
    QList<QPair<QByteArray, QByteArray>> h{{"Content-Type", mime},
                                           {"Accept-Ranges", "bytes"},
                                           {"Content-Length", QByteArray::number(end - start + 1)}};
    if (status == 206)
        h.append({"Content-Range", "bytes " + QByteArray::number(start) + '-' + QByteArray::number(end) + '/'
                                       + QByteArray::number(size)});
    writeHead(status, h);
    if (m_head) {
        finish();
        return;
    }
    file->seek(start);
    m_file = file;
    m_remaining = end - start + 1;
    connect(m_socket, &QTcpSocket::bytesWritten, this, [this] {
        if (m_socket && m_socket->bytesToWrite() < kChunk)
            pumpFile();
    });
    pumpFile();
}

void HttpResponse::pumpFile()
{
    if (!m_file || !m_socket)
        return;
    if (m_remaining <= 0) {
        m_file->close();
        m_file = nullptr;
        finish();
        return;
    }
    const QByteArray chunk = m_file->read(std::min(kChunk, m_remaining));
    if (chunk.isEmpty()) {
        m_remaining = 0;
        finish();
        return;
    }
    m_remaining -= chunk.size();
    m_socket->write(chunk);
}

void HttpResponse::streamProcess(QProcess *process, const QByteArray &mime)
{
    writeHead(200, {{"Content-Type", mime}, {"Cache-Control", "no-cache"}});
    connect(process, &QProcess::readyReadStandardOutput, this, [this, process] {
        if (!m_socket)
            return;
        // Back-pressure: drop the client if it falls ~16 MB behind.
        if (m_socket->bytesToWrite() > 16 * 1024 * 1024) {
            process->kill();
            return;
        }
        m_socket->write(process->readAllStandardOutput());
    });
    connect(this, &HttpResponse::closed, process, [process] {
        process->kill();
    });
    connect(process, &QProcess::finished, this, [this, process] {
        if (m_socket)
            m_socket->write(process->readAllStandardOutput());
        finish();
    });
}

// ── HttpServer ────────────────────────────────────────────────────────────────

HttpServer::HttpServer(Handler handler, QObject *parent)
    : QObject(parent), m_handler(std::move(handler))
{
    connect(&m_server, &QTcpServer::newConnection, this, &HttpServer::onConnection);
}

bool HttpServer::listen(quint16 port, QString *error)
{
    if (m_server.isListening())
        return true;
    if (!m_server.listen(QHostAddress::AnyIPv4, port)) {
        if (error)
            *error = m_server.errorString();
        return false;
    }
    return true;
}

void HttpServer::close() { m_server.close(); }
bool HttpServer::isListening() const { return m_server.isListening(); }

void HttpServer::onConnection()
{
    while (QTcpSocket *socket = m_server.nextPendingConnection()) {
        connect(socket, &QTcpSocket::disconnected, socket, &QObject::deleteLater);
        new Connection(socket, m_handler);
    }
}
