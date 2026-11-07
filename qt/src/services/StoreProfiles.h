#pragma once

#include "core/AppContext.h"

#include <QObject>
#include <QVariantList>
#include <QtQml/qqmlregistration.h>

// Store profiles (name, logo, brand color) reused by the ad wizard. Lived in
// the renderer's localStorage before — now a file in userData, so it survives
// reinstalls and is part of backups.
class StoreProfiles : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(StoreProfiles)
    Q_PROPERTY(QVariantList items READ items NOTIFY itemsChanged)
    Q_PROPERTY(QVariantMap active READ active NOTIFY itemsChanged)

public:
    explicit StoreProfiles(QObject *parent);

    QVariantList items() const { return m_items; }
    QVariantMap active() const;

    // Upsert by id, or by case-insensitive name when id is empty.
    Q_INVOKABLE QVariantMap upsert(const QVariantMap &profile);
    Q_INVOKABLE void remove(const QString &id);
    Q_INVOKABLE void setActive(const QString &id);

signals:
    void itemsChanged();

private:
    void persist();
    QVariantList m_items;
    QString m_activeId;
};
