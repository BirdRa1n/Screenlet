#include "Storage.h"

#include "SystemInfo.h"
#include "core/Async.h"
#include "core/JsonIo.h"
#include "core/Paths.h"

#include <QDesktopServices>
#include <QDir>
#include <QDirIterator>
#include <QFile>
#include <QFileInfo>
#include <QUrl>

namespace {
bool copyTree(const QString &src, const QString &dst)
{
    QDir().mkpath(dst);
    QDirIterator it(src, QDir::Files | QDir::NoDotAndDotDot | QDir::Hidden, QDirIterator::Subdirectories);
    while (it.hasNext()) {
        const QString file = it.next();
        const QString rel = QDir(src).relativeFilePath(file);
        const QString target = QDir(dst).filePath(rel);
        QDir().mkpath(QFileInfo(target).absolutePath());
        QFile::remove(target);
        if (!QFile::copy(file, target))
            return false;
    }
    return true;
}
} // namespace

Storage::Storage(QObject *parent)
    : QObject(parent)
{
    registerInstance();
}

QString Storage::baseDir() const { return Paths::base(); }
QString Storage::exportsDir() const { return Paths::exports(); }

QString Storage::url(const QString &stored) const { return Paths::mediaUrl(stored); }

QString Storage::exportUrl(const QString &filename) const
{
    return QUrl::fromLocalFile(QDir(Paths::exports()).filePath(Paths::safeName(filename))).toString();
}

bool Storage::exists(const QString &stored) const
{
    return !stored.isEmpty() && QFileInfo::exists(Paths::resolveMedia(stored));
}

void Storage::openBaseDir() const { QDesktopServices::openUrl(QUrl::fromLocalFile(Paths::base())); }
void Storage::openExportsDir() const { QDesktopServices::openUrl(QUrl::fromLocalFile(Paths::exports())); }

void Storage::migrate(const QString &newDir, bool copyFiles, QJSValue callback)
{
    const QString target = QDir::cleanPath(newDir);
    if (target.isEmpty() || target == QDir::cleanPath(Paths::base())) {
        Async::invoke(callback, Async::fail(QStringLiteral("Essa já é a pasta atual.")));
        return;
    }
    const QString from = Paths::base();
    Async::run(this, callback, [from, target, copyFiles]() -> QVariant {
        if (!QDir().mkpath(target))
            return Async::fail(QStringLiteral("Não foi possível criar a pasta."));
        if (copyFiles) {
            static const QStringList subdirs{
                QStringLiteral("projects"), QStringLiteral("project-thumbs"), QStringLiteral("assets"),
                QStringLiteral("templates"), QStringLiteral("library"), QStringLiteral("channels"),
                QStringLiteral("schedules"), QStringLiteral("exports"), QStringLiteral("backups")};
            for (const QString &sub : subdirs) {
                const QString src = QDir(from).filePath(sub);
                if (QFileInfo(src).isDir() && !copyTree(src, QDir(target).filePath(sub)))
                    return Async::fail(QStringLiteral("Falha ao copiar a pasta \"%1\".").arg(sub));
            }
        }
        JsonIo::write(Paths::storageConfigFile(), QJsonObject{{QStringLiteral("baseDir"), target}});
        return Async::ok();
    }, [](const QVariant &r) {
        if (r.toMap().value(QStringLiteral("ok")).toBool())
            SystemInfo::instance()->relaunch(400);
    });
}
