#include "Iptv.h"

#include "HttpServer.h"
#include "Players.h"
#include "core/JsonIo.h"
#include "core/Paths.h"
#include "services/Channels.h"
#include "services/Media.h"

#include <QCryptographicHash>
#include <QDateTime>
#include <QDir>
#include <QFileInfo>
#include <QNetworkInterface>
#include <QProcess>
#include <QStandardPaths>
#include <QTemporaryFile>
#include <QUrl>

#include <algorithm>

namespace {
QByteArray xmlEscape(const QString &s) { return s.toHtmlEscaped().toUtf8(); }

// M3U attribute values can't contain quotes or newlines.
QByteArray m3uSafe(const QString &s)
{
    QString out = s;
    out.replace(QLatin1Char('"'), QLatin1Char('\''));
    out.replace(QLatin1Char('\n'), QLatin1Char(' '));
    out.replace(QLatin1Char(','), QLatin1Char(' '));
    return out.toUtf8();
}

QByteArray mimeFor(const QString &file)
{
    const QString ext = QFileInfo(file).suffix().toLower();
    if (ext == QLatin1String("mp4")) return "video/mp4";
    if (ext == QLatin1String("webm")) return "video/webm";
    if (ext == QLatin1String("mov")) return "video/quicktime";
    if (ext == QLatin1String("mkv")) return "video/x-matroska";
    return "application/octet-stream";
}

int ipRank(const QString &ip)
{
    if (ip.startsWith(QLatin1String("192.168."))) return 0;
    if (ip.startsWith(QLatin1String("10."))) return 1;
    const QStringList p = ip.split(QLatin1Char('.'));
    if (p.value(0) == QLatin1String("172")) {
        const int b = p.value(1).toInt();
        if (b >= 16 && b <= 31) return 2;
    }
    return 9; // Tailscale / VPN last
}
} // namespace

Iptv::Iptv(QObject *parent)
    : QObject(parent)
{
    registerInstance();
    m_ffmpeg = findFfmpeg();
    m_server = new HttpServer([this](const HttpRequest &req, HttpResponse *res) { handle(req, res); }, this);
}

bool Iptv::running() const { return m_server->isListening(); }
bool Iptv::ffmpegAvailable() const { return !m_ffmpeg.isEmpty(); }

QStringList Iptv::localIps()
{
    QStringList ips;
    for (const QNetworkInterface &iface : QNetworkInterface::allInterfaces()) {
        if (!(iface.flags() & QNetworkInterface::IsUp) || (iface.flags() & QNetworkInterface::IsLoopBack))
            continue;
        for (const QNetworkAddressEntry &e : iface.addressEntries()) {
            if (e.ip().protocol() == QAbstractSocket::IPv4Protocol)
                ips.append(e.ip().toString());
        }
    }
    std::stable_sort(ips.begin(), ips.end(), [](const QString &a, const QString &b) { return ipRank(a) < ipRank(b); });
    ips.removeDuplicates();
    return ips;
}

QStringList Iptv::ips() const { return localIps(); }

QString Iptv::selectedIp() const
{
    const QStringList list = localIps();
    const QString saved = JsonIo::readObject(Paths::iptvConfigFile()).value(QStringLiteral("selectedIp")).toString();
    if (!saved.isEmpty() && list.contains(saved))
        return saved;
    return list.value(0, QStringLiteral("127.0.0.1"));
}

QString Iptv::baseUrl() const { return QStringLiteral("http://%1:%2").arg(selectedIp()).arg(kPort); }

void Iptv::setIp(const QString &ip)
{
    if (!localIps().contains(ip))
        return;
    QJsonObject cfg = JsonIo::readObject(Paths::iptvConfigFile());
    cfg.insert(QStringLiteral("selectedIp"), ip);
    JsonIo::write(Paths::iptvConfigFile(), cfg, false);
    emit statusChanged();
}

void Iptv::refreshStatus()
{
    m_ffmpeg = findFfmpeg();
    emit statusChanged();
}

QString Iptv::findFfmpeg()
{
    QStringList candidates;
#if defined(Q_OS_WIN)
    candidates << QStringLiteral("C:/ffmpeg/bin/ffmpeg.exe") << QStringLiteral("C:/Program Files/ffmpeg/bin/ffmpeg.exe")
               << QStringLiteral("C:/Program Files (x86)/ffmpeg/bin/ffmpeg.exe")
               << QDir::homePath() + QStringLiteral("/ffmpeg/bin/ffmpeg.exe")
               << QDir::homePath() + QStringLiteral("/scoop/apps/ffmpeg/current/bin/ffmpeg.exe")
               << QStringLiteral("C:/ProgramData/chocolatey/bin/ffmpeg.exe");
#else
    candidates << QStringLiteral("/opt/homebrew/bin/ffmpeg") << QStringLiteral("/usr/local/bin/ffmpeg")
               << QStringLiteral("/usr/bin/ffmpeg");
#endif
    for (const QString &c : candidates)
        if (QFileInfo(c).isExecutable())
            return c;
    return QStandardPaths::findExecutable(QStringLiteral("ffmpeg"));
}

bool Iptv::start()
{
    QString err;
    const bool ok = m_server->listen(kPort, &err);
    m_lastError = ok ? QString() : err;
    emit statusChanged();
    return ok;
}

void Iptv::stop()
{
    m_server->close();
    emit statusChanged();
}

// ── Content ───────────────────────────────────────────────────────────────────

QByteArray Iptv::m3u() const
{
    const QString host = baseUrl();
    QByteArray out = "#EXTM3U x-tvg-url=\"" + host.toUtf8() + "/epg.xml\"\n";
    for (const QJsonObject &ch : Channels::instance()->all()) {
        if (!ch.value(QStringLiteral("enabled")).toBool(true))
            continue;
        const QString id = ch.value(QStringLiteral("id")).toString();
        const QByteArray name = m3uSafe(ch.value(QStringLiteral("name")).toString());
        out += "#EXTINF:-1 tvg-id=\"" + id.toUtf8() + "\" tvg-name=\"" + name + "\" group-title=\"Screenlet\"," + name + '\n';
        if (ch.value(QStringLiteral("loop")).toBool())
            out += "#EXTVLCOPT:input-repeat=65535\n";
        out += host.toUtf8() + "/channel/" + id.toUtf8() + '\n';
    }
    return out;
}

// XMLTV built from the channels' real programming rules (time ranges), in
// local time with the proper UTC offset — the Electron EPG read the dead
// legacy schedules and stamped local times as +0000.
QByteArray Iptv::epg() const
{
    const QDateTime now = QDateTime::currentDateTime();
    const QDate today = now.date();
    const int offsetSecs = now.offsetFromUtc();
    const QString tz = QStringLiteral("%1%2%3")
                           .arg(offsetSecs >= 0 ? QLatin1Char('+') : QLatin1Char('-'))
                           .arg(std::abs(offsetSecs) / 3600, 2, 10, QLatin1Char('0'))
                           .arg((std::abs(offsetSecs) % 3600) / 60, 2, 10, QLatin1Char('0'));
    auto stamp = [&](const QDateTime &dt) { return dt.toString(QStringLiteral("yyyyMMddHHmmss")) + QLatin1Char(' ') + tz; };

    QByteArray xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE tv SYSTEM \"xmltv.dtd\">\n<tv generator-info-name=\"Screenlet\">\n";
    const QList<QJsonObject> channels = Channels::instance()->all();
    for (const QJsonObject &ch : channels)
        xml += "  <channel id=\"" + xmlEscape(ch.value(QStringLiteral("id")).toString()) + "\">\n    <display-name>"
               + xmlEscape(ch.value(QStringLiteral("name")).toString()) + "</display-name>\n  </channel>\n";
    for (const QJsonObject &ch : channels) {
        const QByteArray cid = xmlEscape(ch.value(QStringLiteral("id")).toString());
        bool any = false;
        for (const auto &r : ch.value(QStringLiteral("rules")).toArray()) {
            const QJsonObject rule = r.toObject();
            const QJsonObject s = rule.value(QStringLiteral("schedule")).toObject();
            if (s.value(QStringLiteral("type")).toString() != QLatin1String("time-range"))
                continue;
            const QTime st = QTime::fromString(s.value(QStringLiteral("startTime")).toString(), QStringLiteral("HH:mm"));
            const QTime en = QTime::fromString(s.value(QStringLiteral("endTime")).toString(), QStringLiteral("HH:mm"));
            if (!st.isValid() || !en.isValid())
                continue;
            const QDateTime start(today, st);
            QDateTime stop(today, en);
            if (stop <= start)
                stop = stop.addDays(1);
            xml += "  <programme start=\"" + stamp(start).toUtf8() + "\" stop=\"" + stamp(stop).toUtf8() + "\" channel=\"" + cid
                   + "\">\n    <title>" + xmlEscape(rule.value(QStringLiteral("assetName")).toString()) + "</title>\n  </programme>\n";
            any = true;
        }
        if (!any) {
            const QString asset = Channels::currentAssetAt(ch, now);
            if (!asset.isEmpty())
                xml += "  <programme start=\"" + stamp(QDateTime(today, QTime(0, 0))).toUtf8() + "\" stop=\""
                       + stamp(QDateTime(today.addDays(1), QTime(0, 0))).toUtf8() + "\" channel=\"" + cid + "\">\n    <title>"
                       + xmlEscape(QFileInfo(asset).completeBaseName()) + "</title>\n  </programme>\n";
        }
    }
    xml += "</tv>\n";
    return xml;
}

Iptv::HashEntry Iptv::hashExport(const QString &filename) const
{
    const QString path = QDir(Paths::exports()).filePath(Paths::safeName(filename));
    const QFileInfo fi(path);
    if (!fi.isFile())
        return {};
    const QString key = QStringLiteral("%1:%2").arg(fi.size()).arg(fi.lastModified().toMSecsSinceEpoch());
    {
        QMutexLocker lock(&m_hashMutex);
        const auto it = m_hashCache.constFind(filename);
        if (it != m_hashCache.constEnd() && it->key == key)
            return *it;
    }
    HashEntry e{key, Media::sha256File(path), fi.size()};
    QMutexLocker lock(&m_hashMutex);
    m_hashCache.insert(filename, e);
    return e;
}

QJsonObject Iptv::channelManifest(const QJsonObject &channel) const
{
    QJsonArray items;
    QByteArray sig;
    for (const auto &v : channel.value(QStringLiteral("playlist")).toArray()) {
        const QJsonObject it = v.toObject();
        const QString file = it.value(QStringLiteral("filename")).toString();
        if (file.isEmpty())
            continue;
        const HashEntry h = hashExport(file);
        if (h.hash.isEmpty())
            continue; // file gone — omit rather than advertise a 404
        items.append(QJsonObject{
            {QStringLiteral("filename"), file},
            {QStringLiteral("url"), baseUrl() + QStringLiteral("/exports/") + QString::fromUtf8(QUrl::toPercentEncoding(file))},
            {QStringLiteral("size"), double(h.size)},
            {QStringLiteral("hash"), QStringLiteral("sha256:") + h.hash},
            {QStringLiteral("transition"), it.value(QStringLiteral("transition")).toString(QStringLiteral("cut"))},
        });
        if (!sig.isEmpty())
            sig += '|';
        sig += file.toUtf8() + ":sha256:" + h.hash.toUtf8();
    }
    const QString version = QString::fromLatin1(QCryptographicHash::hash(sig, QCryptographicHash::Sha256).toHex().left(16));
    return {{QStringLiteral("version"), version}, {QStringLiteral("items"), items}};
}

// ── Routing ───────────────────────────────────────────────────────────────────

void Iptv::handle(const HttpRequest &req, HttpResponse *res)
{
    const QString &p = req.path;

    if (p == QLatin1String("/api/player/heartbeat") && req.method == "POST") {
        QJsonParseError err{};
        const QJsonDocument doc = QJsonDocument::fromJson(req.body, &err);
        if (err.error != QJsonParseError::NoError) {
            res->sendText(400, QStringLiteral("invalid json"));
            return;
        }
        QString ip = req.remote.toString();
        if (ip.startsWith(QLatin1String("::ffff:")))
            ip = ip.mid(7);
        Players::instance()->heartbeat(doc.object(), ip);
        res->send(204, {}, {});
        return;
    }
    if (p == QLatin1String("/api/player/sync") && req.method == "GET") {
        const QJsonObject r = Players::instance()->syncResponse(req.query.queryItemValue(QStringLiteral("deviceId")));
        res->sendJson(200, QJsonDocument(r).toJson(QJsonDocument::Compact));
        return;
    }
    if (p.startsWith(QLatin1String("/exports/")) && (req.method == "GET" || req.method == "HEAD")) {
        const QString name = Paths::safeName(p.mid(9));
        if (name.isEmpty()) {
            res->sendText(400, QStringLiteral("bad request"));
            return;
        }
        const QString file = QDir(Paths::exports()).filePath(name);
        if (!QFileInfo(file).isFile()) {
            res->sendText(404, QStringLiteral("not found"));
            return;
        }
        res->sendFile(file, mimeFor(file), req.headers.value("range"));
        return;
    }
    if (p == QLatin1String("/") || p == QLatin1String("/playlist.m3u")) {
        res->send(200, "application/x-mpegurl", m3u());
        return;
    }
    if (p == QLatin1String("/epg.xml")) {
        res->send(200, "text/xml; charset=utf-8", epg());
        return;
    }
    if (p.startsWith(QLatin1String("/channel/"))) {
        serveChannel(Paths::safeName(p.mid(9)), res);
        return;
    }
    res->sendText(404, QStringLiteral("Not found"));
}

// Live MPEG-TS of a channel. Honors the programming rules: while a rule
// matches, its asset loops; otherwise the playlist plays in order (the
// Electron server ignored rules entirely).
void Iptv::serveChannel(const QString &id, HttpResponse *res)
{
    const QJsonObject ch = Channels::instance()->find(id).isEmpty() ? QJsonObject()
                                                                    : QJsonObject::fromVariantMap(Channels::instance()->find(id));
    if (ch.isEmpty()) {
        res->sendText(404, QStringLiteral("Channel not found"));
        return;
    }
    if (m_ffmpeg.isEmpty())
        m_ffmpeg = findFfmpeg();
    if (m_ffmpeg.isEmpty()) {
        res->sendText(503, QStringLiteral("ffmpeg não encontrado — instale o ffmpeg para transmitir via IPTV"));
        return;
    }

    QStringList files;
    const QString ruleAsset = Channels::activeRuleAsset(ch, QDateTime::currentDateTime());
    const bool ruleActive = !ruleAsset.isEmpty();
    if (ruleActive)
        files << ruleAsset;
    else
        for (const auto &v : ch.value(QStringLiteral("playlist")).toArray())
            files << v.toObject().value(QStringLiteral("filename")).toString();

    QStringList paths;
    for (const QString &f : files) {
        const QString path = QDir(Paths::exports()).filePath(Paths::safeName(f));
        if (QFileInfo(path).isFile())
            paths << path;
    }
    if (paths.isEmpty()) {
        res->sendText(404, QStringLiteral("No content for this channel"));
        return;
    }

    auto *list = new QTemporaryFile(QDir::tempPath() + QStringLiteral("/screenlet-pl-XXXXXX.txt"), res);
    if (!list->open()) {
        res->sendText(500, QStringLiteral("temp file error"));
        return;
    }
    QByteArray concat = "ffconcat version 1.0\n";
    for (QString path : paths) {
        path.replace(QLatin1Char('\\'), QLatin1Char('/'));
        path.replace(QLatin1Char('\''), QStringLiteral("'\\''"));
        concat += "file '" + path.toUtf8() + "'\n";
    }
    list->write(concat);
    list->flush();

    const bool loop = ruleActive || ch.value(QStringLiteral("loop")).toBool();
    auto *proc = new QProcess(res);
    QStringList args{QStringLiteral("-hide_banner"), QStringLiteral("-loglevel"), QStringLiteral("error"), QStringLiteral("-re")};
    if (loop)
        args << QStringLiteral("-stream_loop") << QStringLiteral("-1");
    args << QStringLiteral("-f") << QStringLiteral("concat") << QStringLiteral("-safe") << QStringLiteral("0")
         << QStringLiteral("-i") << list->fileName() << QStringLiteral("-c:v") << QStringLiteral("libx264")
         << QStringLiteral("-c:a") << QStringLiteral("aac") << QStringLiteral("-preset") << QStringLiteral("veryfast")
         << QStringLiteral("-tune") << QStringLiteral("zerolatency") << QStringLiteral("-f") << QStringLiteral("mpegts")
         << QStringLiteral("pipe:1");
    proc->setProgram(m_ffmpeg);
    proc->setArguments(args);
    res->streamProcess(proc, "video/mp2t");
    proc->start();
}
