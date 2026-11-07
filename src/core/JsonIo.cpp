#include "JsonIo.h"

#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QRandomGenerator>
#include <QSaveFile>
#include <QUuid>

#include <algorithm>

namespace JsonIo {

QJsonDocument read(const QString &path, bool *ok)
{
    if (ok)
        *ok = false;
    QFile f(path);
    if (!f.open(QIODevice::ReadOnly))
        return {};
    QJsonParseError err{};
    QJsonDocument doc = QJsonDocument::fromJson(f.readAll(), &err);
    if (err.error != QJsonParseError::NoError)
        return {};
    if (ok)
        *ok = true;
    return doc;
}

QJsonObject readObject(const QString &path) { return read(path).object(); }
QJsonArray readArray(const QString &path) { return read(path).array(); }

bool write(const QString &path, const QJsonDocument &doc, bool indented)
{
    QDir().mkpath(QFileInfo(path).absolutePath());
    QSaveFile f(path);
    if (!f.open(QIODevice::WriteOnly))
        return false;
    f.write(doc.toJson(indented ? QJsonDocument::Indented : QJsonDocument::Compact));
    return f.commit();
}

bool write(const QString &path, const QJsonObject &obj, bool indented)
{
    return write(path, QJsonDocument(obj), indented);
}

bool write(const QString &path, const QJsonArray &arr, bool indented)
{
    return write(path, QJsonDocument(arr), indented);
}

QList<QJsonObject> readDir(const QString &dir)
{
    QList<QJsonObject> out;
    const QStringList files = QDir(dir).entryList({QStringLiteral("*.json")}, QDir::Files);
    out.reserve(files.size());
    for (const QString &name : files) {
        bool ok = false;
        const QJsonDocument doc = read(QDir(dir).filePath(name), &ok);
        if (ok && doc.isObject())
            out.append(doc.object());
    }
    return out;
}

QString nowIso()
{
    return QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs);
}

QString newUuid()
{
    return QUuid::createUuid().toString(QUuid::WithoutBraces);
}

QString shortId()
{
    static const char digits[] = "0123456789abcdefghijklmnopqrstuvwxyz";
    QString s;
    s.reserve(8);
    for (int i = 0; i < 8; ++i)
        s.append(QLatin1Char(digits[QRandomGenerator::global()->bounded(36)]));
    return s;
}

QVariantList sortedByDate(QVariantList list, const QString &key, bool desc)
{
    std::stable_sort(list.begin(), list.end(), [&](const QVariant &a, const QVariant &b) {
        const QString da = a.toMap().value(key).toString();
        const QString db = b.toMap().value(key).toString();
        return desc ? da > db : da < db; // ISO-8601 sorts lexically
    });
    return list;
}

} // namespace JsonIo
