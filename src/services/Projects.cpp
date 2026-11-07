#include "Projects.h"

#include "core/JsonIo.h"
#include "core/Paths.h"
#include "render/Renderer.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>

Projects::Projects(QObject *parent)
    : QObject(parent)
{
    registerInstance();
    refresh();
}

QString Projects::fileFor(const QString &id) const
{
    return QDir(Paths::projects()).filePath(Paths::safeName(id) + QStringLiteral(".json"));
}

void Projects::refresh()
{
    // Thumbnails made by builds that couldn't decode WebP (Windows ≤ 2.0.1)
    // came out black: redo them all once, and make any that are missing.
    static constexpr int kThumbsVersion = 2;
    const QString marker = QDir(Paths::projectThumbs()).filePath(QStringLiteral(".version"));
    QFile mf(marker);
    const bool redoAll = !(mf.open(QIODevice::ReadOnly) && mf.readAll().trimmed().toInt() >= kThumbsVersion);
    mf.close();

    QVariantList list;
    for (const QJsonObject &o : JsonIo::readDir(Paths::projects())) {
        const QString id = o.value(QStringLiteral("id")).toString();
        if (id.isEmpty())
            continue;
        const QJsonObject config = o.value(QStringLiteral("config")).toObject();
        const QJsonArray scenes = config.value(QStringLiteral("scenes")).toArray();
        int frames = 0;
        QString firstImage;
        QString firstBg;
        for (const auto &s : scenes) {
            const QJsonObject so = s.toObject();
            frames += so.value(QStringLiteral("durationInFrames")).toInt();
            if (firstImage.isEmpty() && so.value(QStringLiteral("type")).toString() == QLatin1String("product")) {
                firstImage = so.value(QStringLiteral("image")).toString();
                firstBg = so.value(QStringLiteral("bg")).toString();
            }
        }
        const QString thumb = QStringLiteral("project-thumbs/%1.jpg").arg(id);
        if (redoAll || !QFileInfo::exists(Paths::resolveMedia(thumb)))
            Renderer::instance()->renderThumbnail(id, config.toVariantMap());
        list.append(QVariantMap{
            {QStringLiteral("id"), id},
            {QStringLiteral("name"), o.value(QStringLiteral("name")).toString()},
            {QStringLiteral("createdAt"), o.value(QStringLiteral("createdAt")).toString()},
            {QStringLiteral("updatedAt"), o.value(QStringLiteral("updatedAt")).toString()},
            {QStringLiteral("thumbnail"), QFileInfo::exists(Paths::resolveMedia(thumb)) ? thumb : QString()},
            // Cache-buster for QML: changes whenever the JPEG is rewritten.
            {QStringLiteral("thumbStamp"), QFileInfo(Paths::resolveMedia(thumb)).lastModified().toMSecsSinceEpoch()},
            {QStringLiteral("sceneCount"), scenes.size()},
            {QStringLiteral("durationFrames"), frames},
            {QStringLiteral("fps"), config.value(QStringLiteral("fps")).toInt(30)},
            {QStringLiteral("coverImage"), firstImage},
            {QStringLiteral("coverBg"), firstBg},
            {QStringLiteral("exports"), o.value(QStringLiteral("exports")).toArray().toVariantList()},
        });
    }
    if (redoAll && Paths::ensureDir(Paths::projectThumbs()) && mf.open(QIODevice::WriteOnly | QIODevice::Truncate))
        mf.write(QByteArray::number(kThumbsVersion));
    m_items = JsonIo::sortedByDate(list, QStringLiteral("updatedAt"));
    emit itemsChanged();
}

QString Projects::save(const QString &idIn, const QString &name, const QVariantMap &config)
{
    QString id = idIn;
    QJsonObject existing;
    if (!id.isEmpty())
        existing = JsonIo::readObject(fileFor(id));
    if (id.isEmpty())
        id = JsonIo::newUuid();
    const QString now = JsonIo::nowIso();
    QJsonObject data = existing;
    data.insert(QStringLiteral("id"), id);
    data.insert(QStringLiteral("name"), name.trimmed().isEmpty() ? QStringLiteral("Sem título") : name.trimmed());
    data.insert(QStringLiteral("createdAt"), existing.value(QStringLiteral("createdAt")).toString(now));
    data.insert(QStringLiteral("updatedAt"), now);
    QJsonObject cfg = QJsonObject::fromVariantMap(config);
    cfg.remove(QStringLiteral("templates")); // export-only payload, never persisted
    data.insert(QStringLiteral("config"), cfg);
    JsonIo::write(fileFor(id), data);
    refresh();
    Renderer::instance()->renderThumbnail(id, config);
    return id;
}

QVariantMap Projects::load(const QString &id) const
{
    const QJsonObject o = JsonIo::readObject(fileFor(id));
    if (o.isEmpty())
        return {};
    return o.toVariantMap();
}

void Projects::remove(const QString &id)
{
    QFile::remove(fileFor(id));
    QFile::remove(QDir(Paths::projectThumbs()).filePath(Paths::safeName(id) + QStringLiteral(".jpg")));
    refresh();
}

void Projects::rename(const QString &id, const QString &name)
{
    QJsonObject o = JsonIo::readObject(fileFor(id));
    if (o.isEmpty() || name.trimmed().isEmpty())
        return;
    o.insert(QStringLiteral("name"), name.trimmed());
    o.insert(QStringLiteral("updatedAt"), JsonIo::nowIso());
    JsonIo::write(fileFor(id), o);
    refresh();
}

QString Projects::duplicate(const QString &id)
{
    const QJsonObject o = JsonIo::readObject(fileFor(id));
    if (o.isEmpty())
        return {};
    return save(QString(), o.value(QStringLiteral("name")).toString() + QStringLiteral(" (cópia)"),
                o.value(QStringLiteral("config")).toObject().toVariantMap());
}

void Projects::recordExport(const QString &id, const QString &filename, const QString &format, int fps)
{
    if (id.isEmpty())
        return;
    QJsonObject o = JsonIo::readObject(fileFor(id));
    if (o.isEmpty())
        return;
    QJsonArray exports = o.value(QStringLiteral("exports")).toArray();
    for (qsizetype i = exports.size() - 1; i >= 0; --i)
        if (exports.at(i).toObject().value(QStringLiteral("filename")).toString() == filename)
            exports.removeAt(i);
    exports.prepend(QJsonObject{{QStringLiteral("filename"), filename},
                                {QStringLiteral("format"), format},
                                {QStringLiteral("fps"), fps},
                                {QStringLiteral("at"), JsonIo::nowIso()}});
    o.insert(QStringLiteral("exports"), exports);
    JsonIo::write(fileFor(id), o);
    refresh();
}

void Projects::setThumbnailReady(const QString &)
{
    refresh();
}
