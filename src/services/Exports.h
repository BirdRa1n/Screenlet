#pragma once

#include "core/AppContext.h"

#include <QObject>
#include <QVariantList>
#include <QtQml/qqmlregistration.h>

// Rendered videos in exports/.
class Exports : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(Exports)
    Q_PROPERTY(QVariantList items READ items NOTIFY itemsChanged)

public:
    explicit Exports(QObject *parent);

    QVariantList items() const { return m_items; }

    Q_INVOKABLE void refresh();
    Q_INVOKABLE void remove(const QString &filename);
    Q_INVOKABLE void reveal(const QString &filename) const;
    Q_INVOKABLE QString path(const QString &filename) const;

signals:
    void itemsChanged();

private:
    QVariantList m_items;
};
