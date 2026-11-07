#include "Kodi.h"

#include "core/Async.h"
#include "core/JsonIo.h"
#include "core/Paths.h"
#include "core/SecretStore.h"

#include <QDir>
#include <QFile>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QProcess>
#include <QProcessEnvironment>
#include <QRegularExpression>
#include <QStandardPaths>
#include <QTimer>

namespace {
const QString kSshSecret = QStringLiteral("sshPassword_secret");
const QString kKodiSecret = QStringLiteral("kodiHttpPassword_secret");

// Askpass helper: OpenSSH reads the password from this script's stdout,
// which in turn reads it from the child's environment — never argv.
QString askpassScript()
{
    const QString dir = Paths::userData();
#if defined(Q_OS_WIN)
    const QString path = dir + QStringLiteral("/ssh-askpass.cmd");
    const QByteArray body = "@echo off\r\necho %SCREENLET_SSH_PASS%\r\n";
#else
    const QString path = dir + QStringLiteral("/ssh-askpass.sh");
    const QByteArray body = "#!/bin/sh\nprintf '%s\\n' \"$SCREENLET_SSH_PASS\"\n";
#endif
    QFile f(path);
    if (!f.exists() || f.size() != body.size()) {
        if (f.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
            f.write(body);
            f.close();
        }
        QFile::setPermissions(path, QFileDevice::ReadOwner | QFileDevice::WriteOwner | QFileDevice::ExeOwner);
    }
    return path;
}

QString extractSetting(const QString &xml, const QString &id)
{
    const QRegularExpression re(QStringLiteral("id=\"%1\"[^>]*>([^<]*)<").arg(QRegularExpression::escape(id)));
    const auto m = re.match(xml);
    return m.hasMatch() ? m.captured(1).trimmed() : QString();
}
} // namespace

Kodi::Kodi(QObject *parent)
    : QObject(parent), m_net(new QNetworkAccessManager(this))
{
    registerInstance();
    // One-time migration from the synced folder (Electron did the same).
    const QString legacy = QDir(Paths::base()).filePath(QStringLiteral("devices.json"));
    if (QFile::exists(legacy)) {
        if (!QFile::exists(Paths::devicesFile()))
            QFile::copy(legacy, Paths::devicesFile());
        QFile::remove(legacy);
    }
}

QList<QJsonObject> Kodi::readRaw() const
{
    QList<QJsonObject> out;
    for (const auto &v : JsonIo::readArray(Paths::devicesFile()))
        out.append(v.toObject());
    return out;
}

void Kodi::writeRaw(const QList<QJsonObject> &list)
{
    QJsonArray arr;
    for (const auto &o : list)
        arr.append(o);
    JsonIo::write(Paths::devicesFile(), arr);
    emit itemsChanged();
}

QVariantList Kodi::items() const
{
    QVariantList out;
    for (QJsonObject d : readRaw()) {
        const bool hasSsh = !d.value(kSshSecret).toString().isEmpty();
        const bool hasKodi = !d.value(kKodiSecret).toString().isEmpty();
        const bool legacy = !d.value(QStringLiteral("sshPassword_enc")).toString().isEmpty()
                            || !d.value(QStringLiteral("kodiHttpPassword_enc")).toString().isEmpty();
        for (const QString &k : {kSshSecret, kKodiSecret, QStringLiteral("sshPassword_enc"), QStringLiteral("kodiHttpPassword_enc")})
            d.remove(k);
        QVariantMap m = d.toVariantMap();
        m.insert(QStringLiteral("hasSshPassword"), hasSsh);
        m.insert(QStringLiteral("hasKodiPassword"), hasKodi);
        m.insert(QStringLiteral("needsReauth"), legacy && !hasSsh);
        out.append(m);
    }
    return out;
}

QVariantMap Kodi::blank() const
{
    return {
        {QStringLiteral("id"), JsonIo::newUuid()}, {QStringLiteral("name"), QString()}, {QStringLiteral("ip"), QString()},
        {QStringLiteral("sshPort"), 22}, {QStringLiteral("sshUser"), QStringLiteral("root")},
        {QStringLiteral("kodiHttpPort"), 8080}, {QStringLiteral("kodiHttpUser"), QStringLiteral("kodi")},
        {QStringLiteral("defaultChannelId"), QVariant()}, {QStringLiteral("kodiChannelId"), QVariant()},
        {QStringLiteral("restartDelaySecs"), 20},
    };
}

void Kodi::save(const QVariantMap &device)
{
    QList<QJsonObject> list = readRaw();
    QJsonObject d = QJsonObject::fromVariantMap(device);
    const QString id = d.value(QStringLiteral("id")).toString();
    const QString ssh = d.take(QStringLiteral("sshPassword")).toString();
    const QString kodi = d.take(QStringLiteral("kodiHttpPassword")).toString();
    for (const QString &k : {QStringLiteral("hasSshPassword"), QStringLiteral("hasKodiPassword"), QStringLiteral("needsReauth")})
        d.remove(k);

    int idx = -1;
    for (int i = 0; i < list.size(); ++i)
        if (list.at(i).value(QStringLiteral("id")).toString() == id)
            idx = i;
    const QJsonObject prev = idx >= 0 ? list.at(idx) : QJsonObject();
    auto keepOrSet = [&](const QString &key, const QString &plain) {
        if (!plain.isEmpty()) {
            SecretStore::remove(prev.value(key).toString());
            d.insert(key, SecretStore::protect(plain));
        } else if (prev.contains(key)) {
            d.insert(key, prev.value(key));
        }
    };
    keepOrSet(kSshSecret, ssh);
    keepOrSet(kKodiSecret, kodi);
    const QString now = JsonIo::nowIso();
    d.insert(QStringLiteral("createdAt"), prev.value(QStringLiteral("createdAt")).toString(now));
    d.insert(QStringLiteral("updatedAt"), now);
    if (idx >= 0)
        list[idx] = d;
    else
        list.append(d);
    writeRaw(list);
}

void Kodi::remove(const QString &id)
{
    QList<QJsonObject> list = readRaw();
    for (int i = list.size() - 1; i >= 0; --i) {
        if (list.at(i).value(QStringLiteral("id")).toString() == id) {
            SecretStore::remove(list.at(i).value(kSshSecret).toString());
            SecretStore::remove(list.at(i).value(kKodiSecret).toString());
            list.removeAt(i);
        }
    }
    writeRaw(list);
}

Kodi::Device Kodi::withSecrets(const QString &id) const
{
    for (const QJsonObject &d : readRaw())
        if (d.value(QStringLiteral("id")).toString() == id)
            return {d, SecretStore::unprotect(d.value(kSshSecret).toString()),
                    SecretStore::unprotect(d.value(kKodiSecret).toString())};
    return {};
}

// ── Transport ─────────────────────────────────────────────────────────────────

void Kodi::rpc(const QString &ip, int port, const QString &user, const QString &pass, const QString &method,
               const QJsonObject &params, std::function<void(bool, QJsonObject, QString)> done)
{
    QNetworkRequest req(QUrl(QStringLiteral("http://%1:%2/jsonrpc").arg(ip).arg(port > 0 ? port : 8080)));
    req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    req.setRawHeader("Authorization", "Basic " + (user + QLatin1Char(':') + pass).toUtf8().toBase64());
    req.setTransferTimeout(6000);
    const QByteArray body = QJsonDocument(QJsonObject{{QStringLiteral("jsonrpc"), QStringLiteral("2.0")},
                                                      {QStringLiteral("method"), method},
                                                      {QStringLiteral("params"), params},
                                                      {QStringLiteral("id"), 1}})
                                .toJson(QJsonDocument::Compact);
    QNetworkReply *reply = m_net->post(req, body);
    connect(reply, &QNetworkReply::finished, this, [reply, done] {
        reply->deleteLater();
        if (reply->error() == QNetworkReply::OperationCanceledError || reply->error() == QNetworkReply::TimeoutError) {
            done(false, {}, QStringLiteral("Timeout — verifique IP e porta do Kodi"));
            return;
        }
        if (reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt() == 401) {
            done(false, {}, QStringLiteral("Usuário ou senha do Kodi inválidos"));
            return;
        }
        if (reply->error() != QNetworkReply::NoError) {
            done(false, {}, reply->errorString());
            return;
        }
        const QByteArray data = reply->readAll();
        const QJsonDocument doc = QJsonDocument::fromJson(data);
        if (!doc.isObject()) {
            done(false, {}, QStringLiteral("Resposta inválida: %1").arg(QString::fromUtf8(data.left(80))));
            return;
        }
        done(true, doc.object(), {});
    });
}

void Kodi::ssh(const QString &ip, int port, const QString &user, const QString &pass, const QString &command,
               bool tolerant, std::function<void(bool, QString)> done)
{
    const QString sshBin = QStandardPaths::findExecutable(QStringLiteral("ssh"));
    if (sshBin.isEmpty()) {
        done(false, QStringLiteral("Cliente SSH não encontrado no sistema."));
        return;
    }
    auto *proc = new QProcess(this);
    QProcessEnvironment env = QProcessEnvironment::systemEnvironment();
    env.insert(QStringLiteral("SSH_ASKPASS"), askpassScript());
    env.insert(QStringLiteral("SSH_ASKPASS_REQUIRE"), QStringLiteral("force"));
    env.insert(QStringLiteral("DISPLAY"), QStringLiteral(":0"));
    env.insert(QStringLiteral("SCREENLET_SSH_PASS"), pass);
    proc->setProcessEnvironment(env);
    proc->setProcessChannelMode(QProcess::MergedChannels);
    const QString knownHosts = Paths::userData() + QStringLiteral("/known_hosts");
    proc->setProgram(sshBin);
    proc->setArguments({
        QStringLiteral("-p"), QString::number(port > 0 ? port : 22),
        QStringLiteral("-o"), QStringLiteral("StrictHostKeyChecking=accept-new"),
        QStringLiteral("-o"), QStringLiteral("UserKnownHostsFile=") + knownHosts,
        QStringLiteral("-o"), QStringLiteral("ConnectTimeout=10"),
        QStringLiteral("-o"), QStringLiteral("NumberOfPasswordPrompts=1"),
        QStringLiteral("-o"), QStringLiteral("PreferredAuthentications=password,keyboard-interactive"),
        QStringLiteral("-o"), QStringLiteral("BatchMode=no"),
        QStringLiteral("%1@%2").arg(user, ip),
        command,
    });
    auto *timer = new QTimer(proc);
    timer->setSingleShot(true);
    connect(timer, &QTimer::timeout, proc, [proc] { proc->kill(); });
    connect(proc, &QProcess::finished, this, [proc, done, tolerant](int code, QProcess::ExitStatus status) {
        const QString out = QString::fromUtf8(proc->readAll());
        proc->deleteLater();
        if (status != QProcess::NormalExit) {
            done(false, QStringLiteral("SSH timeout (15s)"));
            return;
        }
        if (code == 255) {
            done(false, out.contains(QLatin1String("Permission denied")) ? QStringLiteral("Usuário ou senha SSH inválidos")
                                                                       : out.trimmed());
            return;
        }
        if (code != 0 && !tolerant) {
            done(false, QStringLiteral("Código %1: %2").arg(code).arg(out.trimmed()));
            return;
        }
        done(true, out);
    });
    timer->start(15000);
    proc->start();
}

// ── Operations ────────────────────────────────────────────────────────────────

void Kodi::ping(const QString &id, QJSValue cb)
{
    const Device d = withSecrets(id);
    if (d.raw.isEmpty()) {
        Async::invoke(cb, Async::fail(QStringLiteral("Dispositivo não encontrado.")));
        return;
    }
    rpc(d.raw.value(QStringLiteral("ip")).toString(), d.raw.value(QStringLiteral("kodiHttpPort")).toInt(),
        d.raw.value(QStringLiteral("kodiHttpUser")).toString(), d.kodiPassword, QStringLiteral("JSONRPC.Version"), {},
        [cb](bool ok, const QJsonObject &res, const QString &err) {
            if (!ok) {
                Async::invoke(cb, Async::fail(err));
                return;
            }
            const QJsonObject v = res.value(QStringLiteral("result")).toObject().value(QStringLiteral("version")).toObject();
            const QString ver = v.isEmpty() ? QStringLiteral("desconhecida")
                                            : QStringLiteral("%1.%2.%3").arg(v.value(QStringLiteral("major")).toInt())
                                                  .arg(v.value(QStringLiteral("minor")).toInt())
                                                  .arg(v.value(QStringLiteral("patch")).toInt());
            Async::invoke(cb, Async::ok({{QStringLiteral("version"), ver}}));
        });
}

void Kodi::doRestartAndOpen(const Device &d, std::function<void(bool, QString)> done)
{
    const QString ip = d.raw.value(QStringLiteral("ip")).toString();
    ssh(ip, d.raw.value(QStringLiteral("sshPort")).toInt(), d.raw.value(QStringLiteral("sshUser")).toString(), d.sshPassword,
        QStringLiteral("systemctl restart kodi"), false, [this, d, ip, done](bool ok, const QString &out) {
            if (!ok) {
                done(false, out);
                return;
            }
            const QJsonValue chan = d.raw.value(QStringLiteral("kodiChannelId"));
            if (!chan.isNull() && !chan.isUndefined()) {
                const int delay = d.raw.value(QStringLiteral("restartDelaySecs")).toInt(20);
                QTimer::singleShot(delay * 1000, this, [this, d, ip, chan] {
                    rpc(ip, d.raw.value(QStringLiteral("kodiHttpPort")).toInt(), d.raw.value(QStringLiteral("kodiHttpUser")).toString(),
                        d.kodiPassword, QStringLiteral("Player.Open"),
                        QJsonObject{{QStringLiteral("item"), QJsonObject{{QStringLiteral("channelid"), chan.toInt()}}}},
                        [](bool, const QJsonObject &, const QString &) {});
                });
            }
            done(true, {});
        });
}

void Kodi::restartAndOpen(const QString &id, QJSValue cb)
{
    const Device d = withSecrets(id);
    if (d.raw.isEmpty()) {
        Async::invoke(cb, Async::fail(QStringLiteral("Dispositivo não encontrado.")));
        return;
    }
    doRestartAndOpen(d, [cb](bool ok, const QString &err) { Async::invoke(cb, ok ? Async::ok() : Async::fail(err)); });
}

void Kodi::restartForChannel(const QString &channelId)
{
    for (const QJsonObject &raw : readRaw()) {
        if (raw.value(QStringLiteral("defaultChannelId")).toString() != channelId)
            continue;
        const Device d = withSecrets(raw.value(QStringLiteral("id")).toString());
        doRestartAndOpen(d, [name = raw.value(QStringLiteral("name")).toString()](bool ok, const QString &err) {
            if (!ok)
                qWarning("[kodi] falha ao reiniciar %s: %s", qPrintable(name), qPrintable(err));
        });
    }
}

void Kodi::listChannels(const QVariantMap &c, QJSValue cb)
{
    rpc(c.value(QStringLiteral("ip")).toString(), c.value(QStringLiteral("kodiHttpPort")).toInt(),
        c.value(QStringLiteral("kodiHttpUser")).toString(), c.value(QStringLiteral("kodiHttpPassword")).toString(),
        QStringLiteral("PVR.GetChannels"), QJsonObject{{QStringLiteral("channelgroupid"), QStringLiteral("alltv")}},
        [cb](bool ok, const QJsonObject &res, const QString &) {
            QVariantList out;
            if (ok)
                for (const auto &ch : res.value(QStringLiteral("result")).toObject().value(QStringLiteral("channels")).toArray())
                    out.append(QVariantMap{{QStringLiteral("channelid"), ch.toObject().value(QStringLiteral("channelid")).toInt()},
                                           {QStringLiteral("label"), ch.toObject().value(QStringLiteral("label")).toString()}});
            Async::invoke(cb, out);
        });
}

void Kodi::fetchConfig(const QVariantMap &c, QJSValue cb)
{
    const QString cmd = QStringLiteral(
        "f=/storage/.kodi/userdata/guisettings.xml; [ -f \"$f\" ] || f=$HOME/.kodi/userdata/guisettings.xml; "
        "grep -i webserver \"$f\" 2>/dev/null");
    ssh(c.value(QStringLiteral("ip")).toString(), c.value(QStringLiteral("sshPort")).toInt(),
        c.value(QStringLiteral("sshUser")).toString(), c.value(QStringLiteral("sshPassword")).toString(), cmd, true,
        [cb](bool ok, const QString &out) {
            if (!ok) {
                Async::invoke(cb, Async::fail(out));
                return;
            }
            if (!out.contains(QLatin1String("webserver"))) {
                Async::invoke(cb, Async::fail(QStringLiteral("Arquivo guisettings.xml não encontrado ou sem configurações de webserver.")));
                return;
            }
            if (extractSetting(out, QStringLiteral("services.webserver")) == QLatin1String("false")) {
                Async::invoke(cb, Async::fail(QStringLiteral("Servidor HTTP do Kodi está desativado. Ative em Configurações → Serviços → Controle.")));
                return;
            }
            const QString port = extractSetting(out, QStringLiteral("services.webserverport"));
            const QString user = extractSetting(out, QStringLiteral("services.webserverusername"));
            Async::invoke(cb, Async::ok({
                {QStringLiteral("port"), port.isEmpty() ? 8080 : port.toInt()},
                {QStringLiteral("user"), user.isEmpty() ? QStringLiteral("kodi") : user},
                {QStringLiteral("password"), extractSetting(out, QStringLiteral("services.webserverpassword"))},
                {QStringLiteral("authEnabled"), extractSetting(out, QStringLiteral("services.webserverauthentication")) != QLatin1String("false")},
            }));
        });
}
