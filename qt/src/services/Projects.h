#pragma once

#include "core/AppContext.h"

#include <QObject>
#include <QVariantList>
#include <QtQml/qqmlregistration.h>

// Saved ads (projects/<id>.json: { id, name, createdAt, updatedAt, config }).
//
// Saves are keyed by id (the Electron build keyed by *name*, so two projects
// with the same name overwrote each other). `exports` records the files this
// project was rendered to, which drives the "no ar / rascunho" status.
class Projects : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(Projects)
    Q_PROPERTY(QVariantList items READ items NOTIFY itemsChanged)

public:
    explicit Projects(QObject *parent);

    QVariantList items() const { return m_items; }

    Q_INVOKABLE void refresh();
    // Returns the project id. Empty id → new project.
    Q_INVOKABLE QString save(const QString &id, const QString &name, const QVariantMap &config);
    Q_INVOKABLE QVariantMap load(const QString &id) const;   // { id, name, config, exports }
    Q_INVOKABLE void remove(const QString &id);
    Q_INVOKABLE void rename(const QString &id, const QString &name);
    Q_INVOKABLE QString duplicate(const QString &id);

    void recordExport(const QString &id, const QString &filename, const QString &format, int fps);
    void setThumbnailReady(const QString &id);

signals:
    void itemsChanged();

private:
    QString fileFor(const QString &id) const;
    QVariantList m_items;
};
