#include "Library.h"

#include "core/JsonIo.h"
#include "core/Paths.h"

#include <QDir>
#include <QFile>

Library::Library(QObject *parent)
    : QObject(parent)
{
    registerInstance();
    refresh();
}

QStringList Library::categories() const
{
    QStringList out;
    for (const QVariant &v : m_items) {
        const QString c = v.toMap().value(QStringLiteral("category")).toString().trimmed();
        if (!c.isEmpty() && !out.contains(c))
            out.append(c);
    }
    out.sort(Qt::CaseInsensitive);
    return out;
}

void Library::refresh()
{
    QVariantList list;
    for (const QJsonObject &o : JsonIo::readDir(Paths::library()))
        list.append(o.toVariantMap());
    m_items = JsonIo::sortedByDate(list, QStringLiteral("createdAt"));
    emit itemsChanged();
}

QVariantMap Library::find(const QString &id) const
{
    for (const QVariant &v : m_items)
        if (v.toMap().value(QStringLiteral("id")).toString() == id)
            return v.toMap();
    return {};
}

QVariantMap Library::save(const QVariantMap &product)
{
    QVariantMap p = product;
    const QVariantMap existing = find(p.value(QStringLiteral("id")).toString());
    if (existing.isEmpty()) {
        if (p.value(QStringLiteral("id")).toString().isEmpty())
            p.insert(QStringLiteral("id"), JsonIo::shortId());
        p.insert(QStringLiteral("createdAt"), JsonIo::nowIso());
    } else {
        p.insert(QStringLiteral("createdAt"), existing.value(QStringLiteral("createdAt")));
    }
    const QString id = Paths::safeName(p.value(QStringLiteral("id")).toString());
    JsonIo::write(QDir(Paths::library()).filePath(id + QStringLiteral(".json")), QJsonObject::fromVariantMap(p));
    refresh();
    return p;
}

void Library::remove(const QString &id)
{
    QFile::remove(QDir(Paths::library()).filePath(Paths::safeName(id) + QStringLiteral(".json")));
    refresh();
}
