#include "Media.h"

#include "core/Async.h"
#include "core/JsonIo.h"
#include "core/Paths.h"

#include <QCryptographicHash>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QMutex>
#include <QRegularExpression>

namespace {
const QStringList kImageExts{QStringLiteral("png"), QStringLiteral("jpg"), QStringLiteral("jpeg"),
                             QStringLiteral("webp"), QStringLiteral("gif")};
const QStringList kVideoExts{QStringLiteral("mp4"), QStringLiteral("webm"), QStringLiteral("mov"),
                             QStringLiteral("mkv")};

QMutex g_catalogMutex;

QJsonObject loadCatalog()
{
    QJsonObject c = JsonIo::readObject(Paths::mediaCatalogFile());
    if (!c.contains(QStringLiteral("assets")))
        c = {{QStringLiteral("version"), 1}, {QStringLiteral("assets"), QJsonArray()}};
    return c;
}

// Scans assets/ and catalogs files that appeared outside the app.
QJsonArray syncCatalog()
{
    QMutexLocker lock(&g_catalogMutex);
    QJsonObject catalog = loadCatalog();
    QJsonArray assets = catalog.value(QStringLiteral("assets")).toArray();
    QSet<QString> known;
    for (const auto &a : assets)
        known.insert(a.toObject().value(QStringLiteral("filename")).toString());

    bool changed = false;
    const QFileInfoList files = QDir(Paths::uploads()).entryInfoList(QDir::Files | QDir::NoDotAndDotDot);
    for (const QFileInfo &fi : files) {
        const QString ext = fi.suffix().toLower();
        if (fi.fileName().startsWith(QLatin1Char('.')) || (!kImageExts.contains(ext) && !kVideoExts.contains(ext)))
            continue;
        const QString stored = QStringLiteral("uploads/") + fi.fileName();
        if (known.contains(stored))
            continue;
        const QDateTime born = fi.birthTime().isValid() ? fi.birthTime() : fi.lastModified();
        assets.append(QJsonObject{
            {QStringLiteral("id"), JsonIo::newUuid()},
            {QStringLiteral("filename"), stored},
            {QStringLiteral("originalName"), fi.fileName()},
            {QStringLiteral("type"), Media::typeFor(fi.fileName())},
            {QStringLiteral("size"), double(fi.size())},
            {QStringLiteral("importedAt"), born.toUTC().toString(Qt::ISODateWithMs)},
        });
        changed = true;
    }
    if (changed) {
        catalog.insert(QStringLiteral("assets"), assets);
        JsonIo::write(Paths::mediaCatalogFile(), catalog);
    }
    return assets;
}
} // namespace

Media::Media(QObject *parent)
    : QObject(parent)
{
    registerInstance();
    refresh();
}

QString Media::typeFor(const QString &filename)
{
    return kVideoExts.contains(QFileInfo(filename).suffix().toLower()) ? QStringLiteral("video") : QStringLiteral("image");
}

QString Media::sha256File(const QString &path)
{
    QFile f(path);
    if (!f.open(QIODevice::ReadOnly))
        return {};
    QCryptographicHash h(QCryptographicHash::Sha256);
    if (!h.addData(&f))
        return {};
    return QString::fromLatin1(h.result().toHex());
}

QString Media::copyIntoUploads(const QString &srcPath)
{
    Paths::ensureDir(Paths::uploads());
    const QFileInfo fi(srcPath);
    QString base = fi.completeBaseName();
    base.replace(QRegularExpression(QStringLiteral("[^a-zA-Z0-9_-]")), QStringLiteral("_"));
    base = base.left(40);
    const QString ext = fi.suffix().isEmpty() ? QString() : QStringLiteral(".") + fi.suffix();
    const QString name = QStringLiteral("%1-%2%3").arg(QDateTime::currentMSecsSinceEpoch()).arg(base, ext);
    if (!QFile::copy(srcPath, QDir(Paths::uploads()).filePath(name)))
        return {};
    return QStringLiteral("uploads/") + name;
}

void Media::refresh()
{
    QVariantList list = syncCatalog().toVariantList();
    m_items = JsonIo::sortedByDate(list, QStringLiteral("importedAt"));
    emit itemsChanged();
}

void Media::importFile(const QString &localPath, const QString &type, QJSValue callback)
{
    if (localPath.isEmpty() || !QFileInfo::exists(localPath)) {
        Async::invoke(callback, Async::fail(QStringLiteral("Arquivo não encontrado.")));
        return;
    }
    Async::run(this, callback, [localPath, type]() -> QVariant {
        const QString sha = sha256File(localPath);
        {
            QMutexLocker lock(&g_catalogMutex);
            const QJsonArray assets = loadCatalog().value(QStringLiteral("assets")).toArray();
            if (!sha.isEmpty()) {
                for (const auto &a : assets) {
                    if (a.toObject().value(QStringLiteral("sha256")).toString() == sha)
                        return Async::ok({{QStringLiteral("asset"), a.toObject().toVariantMap()},
                                          {QStringLiteral("duplicate"), true}});
                }
            }
        }
        const QString stored = copyIntoUploads(localPath);
        if (stored.isEmpty())
            return Async::fail(QStringLiteral("Não foi possível copiar o arquivo."));
        const QJsonObject asset{
            {QStringLiteral("id"), JsonIo::newUuid()},
            {QStringLiteral("filename"), stored},
            {QStringLiteral("originalName"), QFileInfo(localPath).fileName()},
            {QStringLiteral("type"), type == QLatin1String("video") ? QStringLiteral("video") : typeFor(localPath)},
            {QStringLiteral("size"), double(QFileInfo(Paths::resolveMedia(stored)).size())},
            {QStringLiteral("sha256"), sha},
            {QStringLiteral("importedAt"), JsonIo::nowIso()},
        };
        QMutexLocker lock(&g_catalogMutex);
        QJsonObject catalog = loadCatalog();
        QJsonArray assets = catalog.value(QStringLiteral("assets")).toArray();
        assets.append(asset);
        catalog.insert(QStringLiteral("assets"), assets);
        JsonIo::write(Paths::mediaCatalogFile(), catalog);
        return Async::ok({{QStringLiteral("asset"), asset.toVariantMap()}});
    }, [this](const QVariant &) { refresh(); });
}

void Media::remove(const QString &id)
{
    {
        QMutexLocker lock(&g_catalogMutex);
        QJsonObject catalog = loadCatalog();
        QJsonArray assets = catalog.value(QStringLiteral("assets")).toArray();
        for (qsizetype i = assets.size() - 1; i >= 0; --i) {
            if (assets.at(i).toObject().value(QStringLiteral("id")).toString() == id)
                assets.removeAt(i);
        }
        catalog.insert(QStringLiteral("assets"), assets);
        JsonIo::write(Paths::mediaCatalogFile(), catalog);
    }
    refresh();
}
