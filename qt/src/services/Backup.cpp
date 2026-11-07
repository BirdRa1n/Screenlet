#include "Backup.h"

#include "Settings.h"
#include "SystemInfo.h"
#include "core/Async.h"
#include "core/JsonIo.h"
#include "core/Paths.h"
#include "core/SecretStore.h"
#include "core/SecureZip.h"

#include <QDateTime>
#include <QDesktopServices>
#include <QDir>
#include <QDirIterator>
#include <QFile>
#include <QFileInfo>
#include <QUrl>

#include <memory>

#include <private/qzipreader_p.h>
#include <private/qzipwriter_p.h>

namespace {
const QString kSecretsEntry = QStringLiteral("_secrets/secrets.json");

struct Item {
    bool isDir;
    QString src;  // absolute
    QString zip;  // path inside the archive
};

struct Category {
    QString key;
    QString label;
    QList<Item> items;
    bool credentials = false; // carries secrets → backup must be password-locked
};

QList<Category> categoryTable()
{
    const QString ud = Paths::userData();
    const QString base = Paths::base();
    auto D = [&](const QString &n) { return Item{true, QDir(base).filePath(n), n}; };
    auto Fud = [&](const QString &n) { return Item{false, QDir(ud).filePath(n), QStringLiteral("_config/") + n}; };
    return {
        {QStringLiteral("projects"), QStringLiteral("Projetos"), {D(QStringLiteral("projects")), D(QStringLiteral("project-thumbs"))}},
        {QStringLiteral("media"), QStringLiteral("Mídia (imagens)"), {D(QStringLiteral("assets"))}},
        {QStringLiteral("videos"), QStringLiteral("Vídeos renderizados"), {D(QStringLiteral("exports"))}},
        {QStringLiteral("templates"), QStringLiteral("Templates"), {D(QStringLiteral("templates"))}},
        {QStringLiteral("library"), QStringLiteral("Biblioteca de produtos"), {D(QStringLiteral("library"))}},
        {QStringLiteral("channels"), QStringLiteral("Canais e programação"), {D(QStringLiteral("channels")), D(QStringLiteral("schedules"))}},
        {QStringLiteral("devices"), QStringLiteral("Dispositivos (credenciais)"),
         {Fud(QStringLiteral("devices.json")), Fud(QStringLiteral("player-devices.json"))}, true},
        {QStringLiteral("settings"), QStringLiteral("Configurações e integrações (chaves de API)"),
         {Fud(QStringLiteral("app-settings.json")), Fud(QStringLiteral("iptv-config.json")),
          Fud(QStringLiteral("integrations.json")), Fud(QStringLiteral("store-profiles.json"))}, true},
    };
}

QList<Category> select(const QStringList &keys)
{
    QList<Category> out;
    for (const Category &c : categoryTable())
        if (keys.contains(c.key))
            out.append(c);
    return out;
}

bool anyCredentials(const QList<Category> &cats)
{
    return std::any_of(cats.cbegin(), cats.cend(), [](const Category &c) { return c.credentials; });
}

QJsonObject readManifest(const QString &zipPath)
{
    // manifest.json is always a plain stored entry, so QZipReader reads it
    // in both formats (Electron/QZipWriter and password-locked AES).
    QZipReader zip(zipPath);
    if (!zip.isReadable())
        return {};
    return QJsonDocument::fromJson(zip.fileData(QStringLiteral("manifest.json"))).object();
}

// Plaintext of every secret the selected categories reference (they live in
// the OS keychain, not in the JSON files — that's why they used to be lost).
QJsonObject collectSecrets(const QList<Category> &cats)
{
    QJsonObject out;
    auto has = [&](const QString &k) {
        return std::any_of(cats.cbegin(), cats.cend(), [&](const Category &c) { return c.key == k; });
    };
    if (has(QStringLiteral("devices"))) {
        QJsonObject devs;
        for (const auto &v : JsonIo::readArray(Paths::devicesFile())) {
            const QJsonObject d = v.toObject();
            QJsonObject s;
            const QString ssh = SecretStore::unprotect(d.value(QStringLiteral("sshPassword_secret")).toString());
            const QString kodi = SecretStore::unprotect(d.value(QStringLiteral("kodiHttpPassword_secret")).toString());
            if (!ssh.isEmpty()) s.insert(QStringLiteral("sshPassword"), ssh);
            if (!kodi.isEmpty()) s.insert(QStringLiteral("kodiHttpPassword"), kodi);
            if (!s.isEmpty())
                devs.insert(d.value(QStringLiteral("id")).toString(), s);
        }
        QJsonObject players;
        for (const auto &v : JsonIo::readArray(Paths::playerDevicesFile())) {
            const QJsonObject p = v.toObject();
            const QString token = SecretStore::unprotect(p.value(QStringLiteral("apiToken_secret")).toString());
            if (!token.isEmpty())
                players.insert(p.value(QStringLiteral("id")).toString(), token);
        }
        out.insert(QStringLiteral("devices"), devs);
        out.insert(QStringLiteral("players"), players);
    }
    if (has(QStringLiteral("settings"))) {
        const QJsonObject se = JsonIo::readObject(Paths::integrationsFile()).value(QStringLiteral("stockeasy")).toObject();
        const QString key = SecretStore::unprotect(se.value(QStringLiteral("apiKey_secret")).toString());
        if (!key.isEmpty())
            out.insert(QStringLiteral("stockeasy"), QJsonObject{{QStringLiteral("apiKey"), key}});
    }
    return out;
}

// Re-seals restored secrets into THIS machine's keychain and points the JSON
// files at the new references.
void applySecrets(const QJsonObject &secrets)
{
    const QJsonObject devs = secrets.value(QStringLiteral("devices")).toObject();
    if (!devs.isEmpty()) {
        QJsonArray list = JsonIo::readArray(Paths::devicesFile());
        for (qsizetype i = 0; i < list.size(); ++i) {
            QJsonObject d = list.at(i).toObject();
            const QJsonObject s = devs.value(d.value(QStringLiteral("id")).toString()).toObject();
            if (s.contains(QStringLiteral("sshPassword")))
                d.insert(QStringLiteral("sshPassword_secret"), SecretStore::protect(s.value(QStringLiteral("sshPassword")).toString()));
            if (s.contains(QStringLiteral("kodiHttpPassword")))
                d.insert(QStringLiteral("kodiHttpPassword_secret"), SecretStore::protect(s.value(QStringLiteral("kodiHttpPassword")).toString()));
            list[i] = d;
        }
        JsonIo::write(Paths::devicesFile(), list);
    }
    const QJsonObject players = secrets.value(QStringLiteral("players")).toObject();
    if (!players.isEmpty()) {
        QJsonArray list = JsonIo::readArray(Paths::playerDevicesFile());
        for (qsizetype i = 0; i < list.size(); ++i) {
            QJsonObject p = list.at(i).toObject();
            const QString token = players.value(p.value(QStringLiteral("id")).toString()).toString();
            if (!token.isEmpty())
                p.insert(QStringLiteral("apiToken_secret"), SecretStore::protect(token));
            list[i] = p;
        }
        JsonIo::write(Paths::playerDevicesFile(), list);
    }
    const QString apiKey = secrets.value(QStringLiteral("stockeasy")).toObject().value(QStringLiteral("apiKey")).toString();
    if (!apiKey.isEmpty()) {
        QJsonObject root = JsonIo::readObject(Paths::integrationsFile());
        QJsonObject se = root.value(QStringLiteral("stockeasy")).toObject();
        se.insert(QStringLiteral("apiKey_secret"), SecretStore::protect(apiKey));
        se.remove(QStringLiteral("apiKey_enc"));
        root.insert(QStringLiteral("stockeasy"), se);
        JsonIo::write(Paths::integrationsFile(), root);
    }
}

// Every (entry name in zip → file on disk) for the selected categories.
QList<QPair<QString, QString>> filesToArchive(const QList<Category> &cats)
{
    QList<QPair<QString, QString>> out;
    for (const Category &c : cats) {
        for (const Item &it : c.items) {
            if (!it.isDir) {
                if (QFileInfo(it.src).isFile())
                    out.append({it.zip, it.src});
                continue;
            }
            QDirIterator dit(it.src, QDir::Files | QDir::NoDotAndDotDot, QDirIterator::Subdirectories);
            while (dit.hasNext()) {
                const QString file = dit.next();
                out.append({it.zip + QLatin1Char('/') + QDir(it.src).relativeFilePath(file), file});
            }
        }
    }
    return out;
}

QString safeRel(const QString &rel)
{
    const QString r = QDir::cleanPath(rel);
    return (r.startsWith(QLatin1String("..")) || QDir::isAbsolutePath(r)) ? QString() : r; // zip-slip guard
}
} // namespace

Backup::Backup(QObject *parent)
    : QObject(parent)
{
    registerInstance();
}

QString Backup::dir() const
{
    QString d = Settings::instance()->backupDir();
    if (d.isEmpty() || !QDir().mkpath(d))
        d = Paths::defaultBackups();
    QDir().mkpath(d);
    return d;
}

void Backup::setBusy(bool b)
{
    m_busy = b;
    emit busyChanged();
}

QVariantList Backup::categories() const
{
    QVariantList out;
    for (const Category &c : categoryTable())
        out.append(QVariantMap{{QStringLiteral("key"), c.key}, {QStringLiteral("label"), c.label},
                               {QStringLiteral("credentials"), c.credentials}});
    return out;
}

bool Backup::needsPassword(const QStringList &keys) const
{
    return anyCredentials(select(keys));
}

void Backup::setDir(const QString &path)
{
    Settings::instance()->setBackupDir(path);
    emit dirChanged();
}

void Backup::openDir() const { QDesktopServices::openUrl(QUrl::fromLocalFile(dir())); }

void Backup::list(QJSValue cb) const
{
    const QString d = dir();
    Async::run(const_cast<Backup *>(this), cb, [d]() -> QVariant {
        QVariantList out;
        for (const QFileInfo &fi : QDir(d).entryInfoList({QStringLiteral("*.zip")}, QDir::Files)) {
            const QJsonObject m = readManifest(fi.absoluteFilePath());
            out.append(QVariantMap{
                {QStringLiteral("filename"), fi.fileName()},
                {QStringLiteral("path"), fi.absoluteFilePath()},
                {QStringLiteral("size"), double(fi.size())},
                {QStringLiteral("createdAt"), m.value(QStringLiteral("createdAt")).toString(fi.lastModified().toUTC().toString(Qt::ISODate))},
                {QStringLiteral("categories"), m.value(QStringLiteral("categories")).toArray().toVariantList()},
                {QStringLiteral("encrypted"), m.value(QStringLiteral("encrypted")).toBool()},
                {QStringLiteral("hasSecrets"), m.value(QStringLiteral("hasSecrets")).toBool()},
            });
        }
        return JsonIo::sortedByDate(out, QStringLiteral("createdAt"));
    });
}

void Backup::create(const QStringList &keys, const QString &password, QJSValue cb)
{
    const QList<Category> selected = select(keys);
    if (selected.isEmpty()) {
        Async::invoke(cb, Async::fail(QStringLiteral("Nenhuma categoria selecionada.")));
        return;
    }
    const bool creds = anyCredentials(selected);
    if (creds && password.size() < 8) {
        Async::invoke(cb, Async::fail(QStringLiteral("Backups com credenciais precisam de uma senha de pelo menos 8 caracteres.")));
        return;
    }
    const QString stamp = QDateTime::currentDateTimeUtc().toString(QStringLiteral("yyyy-MM-ddTHH-mm-ss"));
    const bool locked = !password.isEmpty();
    const QString filename = QStringLiteral("screenlet-backup-%1%2.zip").arg(stamp, locked ? QStringLiteral("-protegido") : QString());
    const QString path = QDir(dir()).filePath(filename);
    // Secrets are read here, on the GUI thread (keychain access).
    const QJsonObject secrets = creds ? collectSecrets(selected) : QJsonObject();

    setBusy(true);
    Async::run(this, cb, [selected, path, filename, password, locked, secrets]() -> QVariant {
        QJsonArray cats;
        for (const Category &c : selected)
            cats.append(c.key);
        const QByteArray manifest = QJsonDocument(QJsonObject{
                                                      {QStringLiteral("formatVersion"), 2},
                                                      {QStringLiteral("createdAt"), JsonIo::nowIso()},
                                                      {QStringLiteral("appVersion"), QStringLiteral(SCREENLET_VERSION)},
                                                      {QStringLiteral("categories"), cats},
                                                      {QStringLiteral("encrypted"), locked},
                                                      {QStringLiteral("hasSecrets"), !secrets.isEmpty()},
                                                  })
                                        .toJson();
        const auto files = filesToArchive(selected);

        if (locked) {
            SecureZipWriter zip;
            bool ok = zip.open(path, password) && zip.addPlain(QStringLiteral("manifest.json"), manifest);
            for (const auto &f : files) {
                if (!ok)
                    break;
                ok = zip.addFile(f.first, f.second);
            }
            if (ok && !secrets.isEmpty())
                ok = zip.addData(kSecretsEntry, QJsonDocument(secrets).toJson(QJsonDocument::Compact));
            ok = ok && zip.close();
            if (!ok) {
                const QString err = zip.errorString();
                QFile::remove(path);
                return Async::fail(err.isEmpty() ? QStringLiteral("Falha ao gravar o backup.") : err);
            }
            return Async::ok({{QStringLiteral("filename"), filename}, {QStringLiteral("encrypted"), true}});
        }

        QZipWriter zip(path);
        if (zip.status() != QZipWriter::NoError)
            return Async::fail(QStringLiteral("Não foi possível criar o arquivo de backup."));
        zip.setCompressionPolicy(QZipWriter::AutoCompress);
        zip.addFile(QStringLiteral("manifest.json"), manifest);
        for (const auto &f : files) {
            QFile src(f.second);
            if (src.open(QIODevice::ReadOnly))
                zip.addFile(f.first, &src);
        }
        zip.close();
        if (zip.status() != QZipWriter::NoError) {
            QFile::remove(path);
            return Async::fail(QStringLiteral("Falha ao gravar o backup."));
        }
        return Async::ok({{QStringLiteral("filename"), filename}, {QStringLiteral("encrypted"), false}});
    }, [this](const QVariant &) { setBusy(false); });
}

void Backup::remove(const QString &filename)
{
    QFile::remove(QDir(dir()).filePath(Paths::safeName(filename)));
}

void Backup::reveal(const QString &filename) const
{
    SystemInfo::instance()->revealFile(QDir(dir()).filePath(Paths::safeName(filename)));
}

QVariantMap Backup::inspect(const QString &zipPath) const
{
    const QJsonObject m = readManifest(zipPath);
    if (m.isEmpty())
        return Async::fail(QStringLiteral("Arquivo de backup inválido ou sem manifesto."));
    return Async::ok({{QStringLiteral("path"), zipPath},
                      {QStringLiteral("filename"), QFileInfo(zipPath).fileName()},
                      {QStringLiteral("categories"), m.value(QStringLiteral("categories")).toArray().toVariantList()},
                      {QStringLiteral("encrypted"), m.value(QStringLiteral("encrypted")).toBool()},
                      {QStringLiteral("hasSecrets"), m.value(QStringLiteral("hasSecrets")).toBool()}});
}

bool Backup::checkPassword(const QString &zipPath, const QString &password) const
{
    SecureZipReader zip;
    return zip.open(zipPath) && zip.checkPassword(password);
}

void Backup::restore(const QString &zipPath, const QStringList &keys, const QString &password, QJSValue cb)
{
    const QList<Category> selected = select(keys);
    if (!QFileInfo::exists(zipPath)) {
        Async::invoke(cb, Async::fail(QStringLiteral("Backup não encontrado.")));
        return;
    }
    if (selected.isEmpty()) {
        Async::invoke(cb, Async::fail(QStringLiteral("Nenhuma categoria selecionada.")));
        return;
    }
    const QJsonObject manifest = readManifest(zipPath);
    const bool locked = manifest.value(QStringLiteral("encrypted")).toBool();
    if (locked && !checkPassword(zipPath, password)) {
        Async::invoke(cb, Async::fail(QStringLiteral("Senha incorreta.")));
        return;
    }

    setBusy(true);
    // Secrets travel worker → GUI thread through this holder only; they're
    // never part of the result handed to QML.
    auto restored = std::make_shared<QJsonObject>();
    Async::run(this, cb, [zipPath, selected, password, locked, restored]() -> QVariant {
        QJsonObject secrets;

        if (locked) {
            SecureZipReader zip;
            if (!zip.open(zipPath))
                return Async::fail(QStringLiteral("Não foi possível ler o backup."));
            const auto entries = zip.entries();
            for (const Category &c : selected) {
                for (const Item &it : c.items) {
                    if (!it.isDir) {
                        for (const auto &e : entries)
                            if (e.name == it.zip) {
                                QString err;
                                if (!zip.extract(e, password, it.src, &err))
                                    return Async::fail(err);
                            }
                        continue;
                    }
                    const QString prefix = it.zip + QLatin1Char('/');
                    const bool any = std::any_of(entries.cbegin(), entries.cend(), [&](const auto &e) { return e.name.startsWith(prefix); });
                    if (!any)
                        continue;
                    QDir(it.src).removeRecursively();
                    QDir().mkpath(it.src);
                    for (const auto &e : entries) {
                        if (!e.name.startsWith(prefix))
                            continue;
                        const QString rel = safeRel(e.name.mid(prefix.size()));
                        if (rel.isEmpty())
                            continue;
                        QString err;
                        if (!zip.extract(e, password, QDir(it.src).filePath(rel), &err))
                            return Async::fail(err);
                    }
                }
            }
            if (anyCredentials(selected)) {
                QString err;
                const QByteArray s = zip.read(kSecretsEntry, password, &err);
                QJsonObject all = QJsonDocument::fromJson(s).object();
                // Only the secrets of the categories being restored.
                const bool dev = std::any_of(selected.cbegin(), selected.cend(), [](const Category &c) { return c.key == QLatin1String("devices"); });
                const bool set = std::any_of(selected.cbegin(), selected.cend(), [](const Category &c) { return c.key == QLatin1String("settings"); });
                if (!dev) { all.remove(QStringLiteral("devices")); all.remove(QStringLiteral("players")); }
                if (!set) all.remove(QStringLiteral("stockeasy"));
                secrets = all;
            }
            *restored = secrets;
            return Async::ok({{QStringLiteral("credentialsRestored"), !secrets.isEmpty()}});
        }

        QZipReader zip(zipPath);
        if (!zip.isReadable())
            return Async::fail(QStringLiteral("Não foi possível ler o backup."));
        const QList<QZipReader::FileInfo> entries = zip.fileInfoList();
        for (const Category &c : selected) {
            for (const Item &it : c.items) {
                if (!it.isDir) {
                    const QByteArray data = zip.fileData(it.zip);
                    if (data.isNull())
                        continue;
                    QDir().mkpath(QFileInfo(it.src).absolutePath());
                    QFile f(it.src);
                    if (f.open(QIODevice::WriteOnly | QIODevice::Truncate))
                        f.write(data);
                    continue;
                }
                const QString prefix = it.zip + QLatin1Char('/');
                bool any = false;
                for (const auto &e : entries)
                    if (e.isFile && e.filePath.startsWith(prefix))
                        any = true;
                if (!any)
                    continue;
                // Replace the folder wholesale so files deleted since the
                // backup don't linger.
                QDir(it.src).removeRecursively();
                QDir().mkpath(it.src);
                for (const auto &e : entries) {
                    if (!e.isFile || !e.filePath.startsWith(prefix))
                        continue;
                    const QString rel = safeRel(e.filePath.mid(prefix.size()));
                    if (rel.isEmpty())
                        continue;
                    const QString dest = QDir(it.src).filePath(rel);
                    QDir().mkpath(QFileInfo(dest).absolutePath());
                    QFile f(dest);
                    if (f.open(QIODevice::WriteOnly | QIODevice::Truncate))
                        f.write(zip.fileData(e.filePath));
                }
            }
        }
        return Async::ok();
    }, [this, restored](const QVariant &r) {
        setBusy(false);
        if (!r.toMap().value(QStringLiteral("ok")).toBool())
            return;
        // Keychain writes on the GUI thread, then relaunch.
        applySecrets(*restored);
        *restored = QJsonObject();
        SystemInfo::instance()->relaunch(600);
    });
}
