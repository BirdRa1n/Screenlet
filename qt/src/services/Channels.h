#pragma once

#include "core/AppContext.h"

#include <QDateTime>
#include <QJsonObject>
#include <QObject>
#include <QVariantList>
#include <QtQml/qqmlregistration.h>

// Channels (channels/<id>.json) + the programming engine.
class Channels : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(Channels)
    Q_PROPERTY(QVariantList items READ items NOTIFY itemsChanged)

public:
    explicit Channels(QObject *parent);

    QVariantList items() const { return m_items; }

    Q_INVOKABLE void refresh();
    Q_INVOKABLE QVariantMap find(const QString &id) const;
    // Saves the WHOLE object it is given (the Electron dialog dropped `rules`
    // when editing the name). Screens are only restarted when what they play
    // actually changed.
    Q_INVOKABLE QVariantMap save(const QVariantMap &channel);
    Q_INVOKABLE void remove(const QString &id);
    Q_INVOKABLE QVariantMap blank() const;

    // Programming engine: first matching rule wins, else playlist[0].
    Q_INVOKABLE QString currentAsset(const QVariantMap &channel) const;
    // Channels (enabled ones) whose playlist or rules reference `filename`.
    Q_INVOKABLE QVariantList channelsUsing(const QString &filename) const;

    static QString currentAssetAt(const QJsonObject &channel, const QDateTime &now);
    // Asset of the first matching rule, or empty when no rule matches.
    static QString activeRuleAsset(const QJsonObject &channel, const QDateTime &now);
    static bool usesAsset(const QJsonObject &channel, const QString &filename);

    // After an export overwrote `filename`: bump updatedAt of channels that
    // use it and resync their screens. Returns [{id, name}].
    QVariantList resyncChannelsUsing(const QString &filename);

    QList<QJsonObject> all() const;

signals:
    void itemsChanged();
    void contentChanged(const QString &channelId);

private:
    QString fileFor(const QString &id) const;
    QVariantList m_items;
};
