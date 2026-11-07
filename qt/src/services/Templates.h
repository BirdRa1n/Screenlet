#pragma once

#include "core/AppContext.h"

#include <QJsonArray>
#include <QObject>
#include <QVariantList>
#include <QtQml/qqmlregistration.h>

// Built-in templates (bundled JSON, read-only) + user templates (templates/).
class Templates : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(Templates)
    Q_PROPERTY(QVariantList items READ items NOTIFY itemsChanged)

public:
    explicit Templates(QObject *parent);

    QVariantList items() const { return m_items; }

    Q_INVOKABLE void refresh();
    Q_INVOKABLE QVariantMap find(const QString &id) const;
    Q_INVOKABLE bool isBuiltin(const QString &id) const;
    Q_INVOKABLE bool save(const QVariantMap &tpl);
    Q_INVOKABLE void remove(const QString &id);
    Q_INVOKABLE QString duplicate(const QString &id);
    Q_INVOKABLE bool exportTo(const QString &id, const QString &localPath) const;
    Q_INVOKABLE QVariantMap importFrom(const QString &localPath);
    Q_INVOKABLE QVariantMap blank() const;

    QJsonArray allAsJson() const;

signals:
    void itemsChanged();

private:
    QVariantList m_builtin;
    QVariantList m_items;
};
