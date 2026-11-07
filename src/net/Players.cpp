#include "Players.h"

#include "Iptv.h"
#include "core/Async.h"
#include "core/JsonIo.h"
#include "core/Paths.h"
#include "core/SecretStore.h"
#include "services/Channels.h"

#include <QDateTime>
#include <QDir>
#include <QJsonArray>
#include <QJsonDocument>
#include <QTimer>
#include <QFile>
#include <QNetworkAccessManager>
#include <QNetworkInterface>
#include <QNetworkReply>

#include <memory>

namespace {
const QString kToken = QStringLiteral("apiToken_secret");

// Usable hosts of every local IPv4 subnet up to /23 (skips big VPN ranges).
QStringList scanTargets()
{
    QStringList hosts;
    for (const QNetworkInterface &iface : QNetworkInterface::allInterfaces()) {
        if (!(iface.flags() & QNetworkInterface::IsUp) || (iface.flags() & QNetworkInterface::IsLoopBack))
            continue;
        for (const QNetworkAddressEntry &e : iface.addressEntries()) {
            if (e.ip().protocol() != QAbstractSocket::IPv4Protocol)
                continue;
            const quint32 ip = e.ip().toIPv4Address();
            const quint32 mask = e.netmask().toIPv4Address();
            const quint32 net = ip & mask;
            const quint32 bcast = net | ~mask;
            if (bcast <= net + 1 || bcast - net - 1 > 510)
                continue;
            for (quint32 h = net + 1; h < bcast; ++h)
                if (h != ip)
                    hosts.append(QHostAddress(h).toString());
        }
    }
    hosts.removeDuplicates();
    return hosts;
}
} // namespace

Players::Players(QObject *parent)
    : QObject(parent), m_net(new QNetworkAccessManager(this))
{
    registerInstance();
    const QString legacy = QDir(Paths::base()).filePath(QStringLiteral("player-devices.json"));
    if (QFile::exists(legacy) && !QFile::exists(Paths::playerDevicesFile()))
        QFile::copy(legacy, Paths::playerDevicesFile());

    // Paired players that went quiet may be polling an old address of this PC.
    auto *timer = new QTimer(this);
    timer->setInterval(60000);
    connect(timer, &QTimer::timeout, this, [this] { announceStudio(true); });
    timer->start();
}

QList<QJsonObject> Players::readRaw() const
{
    QList<QJsonObject> out;
    for (const auto &v : JsonIo::readArray(Paths::playerDevicesFile()))
        out.append(v.toObject());
    return out;
}

void Players::writeRaw(const QList<QJsonObject> &list)
{
    QJsonArray arr;
    for (const auto &o : list)
        arr.append(o);
    JsonIo::write(Paths::playerDevicesFile(), arr);
    emit itemsChanged();
}

QVariantList Players::items() const
{
    QVariantList out;
    for (QJsonObject d : readRaw()) {
        const bool has = !d.value(kToken).toString().isEmpty();
        d.remove(kToken);
        d.remove(QStringLiteral("apiToken_enc"));
        QVariantMap m = d.toVariantMap();
        m.insert(QStringLiteral("hasApiToken"), has);
        out.append(m);
    }
    return out;
}

void Players::heartbeat(const QJsonObject &b, const QString &remoteIp)
{
    const QString deviceId = b.value(QStringLiteral("deviceId")).toString();
    if (deviceId.isEmpty())
        return;
    QList<QJsonObject> list = readRaw();
    const QString now = JsonIo::nowIso();
    const QString apiUrl = remoteIp.isEmpty() ? QString() : QStringLiteral("http://%1:%2").arg(remoteIp).arg(kControlPort);
    for (QJsonObject &d : list) {
        if (d.value(QStringLiteral("deviceId")).toString() != deviceId)
            continue;
        auto keep = [&](const QString &k) {
            const QString v = b.value(k).toString();
            if (!v.isEmpty())
                d.insert(k, v);
        };
        keep(QStringLiteral("hostname"));
        keep(QStringLiteral("pairingCode"));
        keep(QStringLiteral("playerVersion"));
        d.insert(QStringLiteral("playing"), b.value(QStringLiteral("playing")).toBool());
        d.insert(QStringLiteral("source"), b.value(QStringLiteral("source")));
        if (!apiUrl.isEmpty())
            d.insert(QStringLiteral("apiUrl"), apiUrl);
        d.insert(QStringLiteral("lastSeenAt"), now);
        writeRaw(list);
        return;
    }
    const QString host = b.value(QStringLiteral("hostname")).toString();
    list.append(QJsonObject{
        {QStringLiteral("id"), JsonIo::newUuid()}, {QStringLiteral("deviceId"), deviceId},
        {QStringLiteral("name"), host.isEmpty() ? deviceId.left(8) : host}, {QStringLiteral("hostname"), host},
        {QStringLiteral("pairingCode"), b.value(QStringLiteral("pairingCode")).toString()},
        {QStringLiteral("playerVersion"), b.value(QStringLiteral("playerVersion")).toString()},
        {QStringLiteral("channelId"), QJsonValue::Null}, {QStringLiteral("paired"), false},
        {QStringLiteral("playing"), b.value(QStringLiteral("playing")).toBool()},
        {QStringLiteral("source"), b.value(QStringLiteral("source"))}, {QStringLiteral("apiUrl"), apiUrl},
        {QStringLiteral("lastSeenAt"), now}, {QStringLiteral("pairedAt"), QJsonValue::Null}, {QStringLiteral("createdAt"), now},
    });
    writeRaw(list);
}

QJsonObject Players::syncChannel(const QString &deviceId) const
{
    if (deviceId.isEmpty())
        return {};
    for (const QJsonObject &d : readRaw()) {
        if (d.value(QStringLiteral("deviceId")).toString() != deviceId)
            continue;
        if (!d.value(QStringLiteral("paired")).toBool() || d.value(QStringLiteral("channelId")).toString().isEmpty())
            return {};
        return QJsonObject::fromVariantMap(Channels::instance()->find(d.value(QStringLiteral("channelId")).toString()));
    }
    return {};
}

bool Players::hasPaired() const
{
    for (const QJsonObject &d : readRaw())
        if (d.value(QStringLiteral("paired")).toBool())
            return true;
    return false;
}

void Players::announceStudio(bool onlyOffline)
{
    if (!Iptv::instance()->running())
        return;
    const qint64 now = QDateTime::currentMSecsSinceEpoch();
    for (const QJsonObject &d : readRaw()) {
        const QString deviceId = d.value(QStringLiteral("deviceId")).toString();
        const QString apiUrl = d.value(QStringLiteral("apiUrl")).toString();
        const QString tokenRef = d.value(kToken).toString();
        if (!d.value(QStringLiteral("paired")).toBool() || apiUrl.isEmpty() || tokenRef.isEmpty())
            continue;
        if (onlyOffline) {
            const QDateTime seen = QDateTime::fromString(d.value(QStringLiteral("lastSeenAt")).toString(), Qt::ISODateWithMs);
            if (seen.isValid() && seen.msecsTo(QDateTime::currentDateTimeUtc()) < 90000)
                continue; // heartbeats are arriving: it already knows where we are
            if (now - m_lastAnnounce.value(deviceId) < 5 * 60000)
                continue;
        }
        m_lastAnnounce.insert(deviceId, now);
        const QString token = SecretStore::unprotect(tokenRef);
        if (token.isEmpty())
            continue;
        const QUrl url(apiUrl + QStringLiteral("/studio"));
        QNetworkRequest req(url);
        req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
        req.setRawHeader("Authorization", "Bearer " + token.toUtf8());
        req.setTransferTimeout(4000);
        const QString studioUrl = Iptv::instance()->baseUrlFor(QHostAddress(url.host()));
        QNetworkReply *reply = m_net->post(req, QJsonDocument(QJsonObject{{QStringLiteral("studioUrl"), studioUrl}}).toJson(QJsonDocument::Compact));
        connect(reply, &QNetworkReply::finished, reply, &QObject::deleteLater);
    }
}

void Players::upsertFound(const QJsonObject &f, const QString &ip)
{
    const QString deviceId = f.value(QStringLiteral("deviceId")).toString();
    QList<QJsonObject> list = readRaw();
    const QString now = JsonIo::nowIso();
    const QString apiUrl = QStringLiteral("http://%1:%2").arg(ip).arg(kControlPort);
    for (QJsonObject &d : list) {
        if (d.value(QStringLiteral("deviceId")).toString() == deviceId) {
            if (!f.value(QStringLiteral("hostname")).toString().isEmpty())
                d.insert(QStringLiteral("hostname"), f.value(QStringLiteral("hostname")));
            if (!f.value(QStringLiteral("playerVersion")).toString().isEmpty())
                d.insert(QStringLiteral("playerVersion"), f.value(QStringLiteral("playerVersion")));
            d.insert(QStringLiteral("apiUrl"), apiUrl);
            d.insert(QStringLiteral("lastSeenAt"), now);
            writeRaw(list);
            return;
        }
    }
    const QString host = f.value(QStringLiteral("hostname")).toString();
    list.append(QJsonObject{
        {QStringLiteral("id"), JsonIo::newUuid()}, {QStringLiteral("deviceId"), deviceId},
        {QStringLiteral("name"), host.isEmpty() ? deviceId.left(8) : host}, {QStringLiteral("hostname"), host},
        {QStringLiteral("pairingCode"), QString()}, {QStringLiteral("playerVersion"), f.value(QStringLiteral("playerVersion")).toString()},
        {QStringLiteral("channelId"), QJsonValue::Null}, {QStringLiteral("paired"), false}, {QStringLiteral("playing"), false},
        {QStringLiteral("source"), QJsonValue::Null}, {QStringLiteral("apiUrl"), apiUrl}, {QStringLiteral("lastSeenAt"), now},
        {QStringLiteral("pairedAt"), QJsonValue::Null}, {QStringLiteral("createdAt"), now},
    });
    writeRaw(list);
}

void Players::scan(QJSValue cb)
{
    if (m_scanning) {
        Async::invoke(cb, Async::fail(QStringLiteral("Varredura já em andamento.")));
        return;
    }
    m_scanning = true;
    emit scanningChanged();

    struct State {
        QStringList queue;
        int inFlight = 0;
        int found = 0;
        QJSValue cb;
    };
    auto st = std::make_shared<State>();
    st->queue = scanTargets();
    st->cb = cb;

    // In-flight replies hold the only strong refs to `pump`, so it frees
    // itself once the last probe returns.
    auto pump = std::make_shared<std::function<void()>>();
    std::weak_ptr<std::function<void()>> weak = pump;
    *pump = [this, st, weak]() {
        auto pump = weak.lock();
        if (!pump)
            return;
        while (st->inFlight < 48 && !st->queue.isEmpty()) {
            const QString ip = st->queue.takeFirst();
            ++st->inFlight;
            QNetworkRequest req(QUrl(QStringLiteral("http://%1:%2/identify").arg(ip).arg(kControlPort)));
            req.setTransferTimeout(800);
            QNetworkReply *reply = m_net->get(req);
            connect(reply, &QNetworkReply::finished, this, [this, reply, ip, st, pump] {
                reply->deleteLater();
                --st->inFlight;
                if (reply->error() == QNetworkReply::NoError) {
                    const QJsonObject o = QJsonDocument::fromJson(reply->readAll()).object();
                    if (o.value(QStringLiteral("deviceId")).isString() && o.value(QStringLiteral("claimed")).toBool(true) == false) {
                        upsertFound(o, ip);
                        ++st->found;
                    }
                }
                (*pump)();
            });
        }
        if (st->inFlight == 0 && st->queue.isEmpty()) {
            m_scanning = false;
            emit scanningChanged();
            Async::invoke(st->cb, Async::ok({{QStringLiteral("found"), st->found}}));
        }
    };
    (*pump)();
}

void Players::claim(const QString &id, const QString &channelId, const QString &name, QJSValue cb)
{
    QList<QJsonObject> list = readRaw();
    int idx = -1;
    for (int i = 0; i < list.size(); ++i)
        if (list.at(i).value(QStringLiteral("id")).toString() == id)
            idx = i;
    if (idx < 0) {
        Async::invoke(cb, Async::fail(QStringLiteral("Dispositivo não encontrado.")));
        return;
    }
    auto finish = [this, id, channelId, name, cb](const QString &tokenRef) {
        QList<QJsonObject> l = readRaw();
        for (QJsonObject &d : l) {
            if (d.value(QStringLiteral("id")).toString() != id)
                continue;
            d.insert(QStringLiteral("channelId"), channelId);
            if (!name.trimmed().isEmpty())
                d.insert(QStringLiteral("name"), name.trimmed());
            d.insert(QStringLiteral("paired"), true);
            d.insert(QStringLiteral("pairedAt"), JsonIo::nowIso());
            d.insert(kToken, tokenRef);
        }
        writeRaw(l);
        Async::invoke(cb, Async::ok());
    };

    const QJsonObject d = list.at(idx);
    if (!d.value(kToken).toString().isEmpty()) { // re-claim after a local unpair
        finish(d.value(kToken).toString());
        return;
    }
    const QString apiUrl = d.value(QStringLiteral("apiUrl")).toString();
    if (apiUrl.isEmpty()) {
        Async::invoke(cb, Async::fail(QStringLiteral("URL do player desconhecida — rode uma varredura na rede ou aguarde um novo heartbeat antes de parear.")));
        return;
    }
    QNetworkRequest req(QUrl(apiUrl + QStringLiteral("/claim")));
    req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    req.setTransferTimeout(5000);
    // The address on the player's own subnet — the "selected IP" may be a VPN
    // or another NIC the device can't reach.
    const QString studioUrl = Iptv::instance()->baseUrlFor(QHostAddress(QUrl(apiUrl).host()));
    const QByteArray body = QJsonDocument(QJsonObject{{QStringLiteral("studioUrl"), studioUrl}}).toJson(QJsonDocument::Compact);
    QNetworkReply *reply = m_net->post(req, body);
    connect(reply, &QNetworkReply::finished, this, [reply, cb, finish] {
        reply->deleteLater();
        const int status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QByteArray data = reply->readAll();
        if (status == 409) {
            Async::invoke(cb, Async::fail(QStringLiteral("Este player já foi pareado com outro Screenlet.")));
            return;
        }
        if (reply->error() != QNetworkReply::NoError && status == 0) {
            Async::invoke(cb, Async::fail(QStringLiteral("Não foi possível parear: %1").arg(reply->errorString())));
            return;
        }
        if (status < 200 || status >= 300) {
            Async::invoke(cb, Async::fail(QStringLiteral("Player respondeu %1: %2").arg(status).arg(QString::fromUtf8(data))));
            return;
        }
        const QString token = QJsonDocument::fromJson(data).object().value(QStringLiteral("token")).toString();
        if (token.isEmpty()) {
            Async::invoke(cb, Async::fail(QStringLiteral("Player não retornou um token de autenticação válido.")));
            return;
        }
        finish(SecretStore::protect(token));
    });
}

void Players::unpair(const QString &id)
{
    QList<QJsonObject> list = readRaw();
    for (QJsonObject &d : list) {
        if (d.value(QStringLiteral("id")).toString() == id) {
            d.insert(QStringLiteral("paired"), false);
            d.insert(QStringLiteral("channelId"), QJsonValue::Null);
            d.insert(QStringLiteral("pairedAt"), QJsonValue::Null);
        }
    }
    writeRaw(list);
}

void Players::remove(const QString &id)
{
    QList<QJsonObject> list = readRaw();
    for (int i = list.size() - 1; i >= 0; --i) {
        if (list.at(i).value(QStringLiteral("id")).toString() == id) {
            SecretStore::remove(list.at(i).value(kToken).toString());
            list.removeAt(i);
        }
    }
    writeRaw(list);
}
