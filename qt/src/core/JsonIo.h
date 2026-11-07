#pragma once

#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QString>
#include <QVariantList>

// Small JSON file helpers. Every write goes through QSaveFile (write to a
// temp file, then atomic rename) so a crash mid-write can never leave a
// truncated JSON behind — a known weakness of the Electron version.
namespace JsonIo {

QJsonDocument read(const QString &path, bool *ok = nullptr);
QJsonObject readObject(const QString &path);
QJsonArray readArray(const QString &path);

bool write(const QString &path, const QJsonDocument &doc, bool indented = true);
bool write(const QString &path, const QJsonObject &obj, bool indented = true);
bool write(const QString &path, const QJsonArray &arr, bool indented = true);

// Every *.json in `dir` parsed as an object (unparseable files are skipped).
QList<QJsonObject> readDir(const QString &dir);

QString nowIso();
QString newUuid();
QString shortId(); // 8 chars base36, like makeId() in the renderer

QVariantList sortedByDate(QVariantList list, const QString &key, bool desc = true);

} // namespace JsonIo
