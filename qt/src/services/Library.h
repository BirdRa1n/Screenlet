#pragma once

#include "core/AppContext.h"

#include <QObject>
#include <QVariantList>
#include <QtQml/qqmlregistration.h>

// Product library (library/<id>.json).
class Library : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(Library)
    Q_PROPERTY(QVariantList items READ items NOTIFY itemsChanged)
    Q_PROPERTY(QStringList categories READ categories NOTIFY itemsChanged)

public:
    explicit Library(QObject *parent);

    QVariantList items() const { return m_items; }
    QStringList categories() const;

    Q_INVOKABLE void refresh();
    Q_INVOKABLE QVariantMap find(const QString &id) const;
    // Upsert: keeps id/createdAt of an existing product. Returns the saved product.
    Q_INVOKABLE QVariantMap save(const QVariantMap &product);
    Q_INVOKABLE void remove(const QString &id);

signals:
    void itemsChanged();

private:
    QVariantList m_items;
};
