#pragma once

#include "core/AppContext.h"

#include <QJSValue>
#include <QObject>
#include <QVariantList>
#include <QtQml/qqmlregistration.h>

// Media Hub catalog (assets/media-catalog.json): auto-discovers files dropped
// into assets/, deduplicates imports by SHA-256 (streamed, not read whole
// into memory), and "removes" non-destructively (catalog entry only, so old
// projects keep working).
class Media : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(Media)
    Q_PROPERTY(QVariantList items READ items NOTIFY itemsChanged)

public:
    explicit Media(QObject *parent);

    QVariantList items() const { return m_items; }

    Q_INVOKABLE void refresh();
    // localPath: file chosen in a FileDialog. callback({ok, asset}).
    Q_INVOKABLE void importFile(const QString &localPath, const QString &type, QJSValue callback);
    Q_INVOKABLE void remove(const QString &id);

    // Copies a file into assets/ and returns "uploads/<name>" (no catalog dedup).
    static QString copyIntoUploads(const QString &srcPath);
    static QString sha256File(const QString &path);
    static QString typeFor(const QString &filename);

signals:
    void itemsChanged();

private:
    QVariantList m_items;
};
