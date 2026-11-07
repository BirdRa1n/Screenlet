#pragma once

#include "core/AppContext.h"

#include <QJSValue>
#include <QObject>
#include <QtQml/qqmlregistration.h>

// Storage location + media path resolution for QML.
class Storage : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(Storage)
    Q_PROPERTY(QString baseDir READ baseDir CONSTANT)
    Q_PROPERTY(QString exportsDir READ exportsDir CONSTANT)

public:
    explicit Storage(QObject *parent);

    QString baseDir() const;
    QString exportsDir() const;

    // "uploads/x.png" → URL string for Image.source / MediaPlayer.source.
    Q_INVOKABLE QString url(const QString &stored) const;
    Q_INVOKABLE QString exportUrl(const QString &filename) const;
    Q_INVOKABLE bool exists(const QString &stored) const;

    Q_INVOKABLE void openBaseDir() const;
    Q_INVOKABLE void openExportsDir() const;

    // Copies every data folder (including exports and thumbnails, which the
    // Electron version forgot) and relaunches so all paths pick it up.
    Q_INVOKABLE void migrate(const QString &newDir, bool copyFiles, QJSValue callback);
};
