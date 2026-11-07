#include "Exports.h"

#include "SystemInfo.h"
#include "core/JsonIo.h"
#include "core/Paths.h"

#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>

Exports::Exports(QObject *parent)
    : QObject(parent)
{
    registerInstance();
    refresh();
}

void Exports::refresh()
{
    static const QStringList filters{QStringLiteral("*.mp4"), QStringLiteral("*.webm"), QStringLiteral("*.mov"),
                                     QStringLiteral("*.mkv"), QStringLiteral("*.MP4")};
    QVariantList list;
    const QFileInfoList files = QDir(Paths::exports()).entryInfoList(filters, QDir::Files);
    for (const QFileInfo &fi : files) {
        const QDateTime born = fi.birthTime().isValid() ? fi.birthTime() : fi.lastModified();
        list.append(QVariantMap{
            {QStringLiteral("filename"), fi.fileName()},
            {QStringLiteral("name"), fi.completeBaseName()},
            {QStringLiteral("size"), double(fi.size())},
            {QStringLiteral("createdAt"), born.toUTC().toString(Qt::ISODateWithMs)},
            {QStringLiteral("modifiedAt"), fi.lastModified().toUTC().toString(Qt::ISODateWithMs)},
        });
    }
    m_items = JsonIo::sortedByDate(list, QStringLiteral("modifiedAt"));
    emit itemsChanged();
}

QString Exports::path(const QString &filename) const
{
    return QDir(Paths::exports()).filePath(Paths::safeName(filename));
}

void Exports::remove(const QString &filename)
{
    QFile::remove(path(filename));
    refresh();
}

void Exports::reveal(const QString &filename) const
{
    SystemInfo::instance()->revealFile(path(filename));
}
