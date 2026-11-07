#pragma once

#include "core/AppContext.h"

#include <QJSValue>
#include <QObject>
#include <QtQml/qqmlregistration.h>

class QNetworkAccessManager;

// StockEasy PDV/ERP integration (userData/integrations.json). The API key is
// stored via SecretStore and never exposed to QML (only hasApiKey).
class StockEasy : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(StockEasy)
    Q_PROPERTY(bool enabled READ enabled WRITE setEnabled NOTIFY changed)
    Q_PROPERTY(QString baseUrl READ baseUrl WRITE setBaseUrl NOTIFY changed)
    Q_PROPERTY(QString selectedStore READ selectedStore WRITE setSelectedStore NOTIFY changed)
    Q_PROPERTY(bool hasApiKey READ hasApiKey NOTIFY changed)
    Q_PROPERTY(bool needsReauth READ needsReauth NOTIFY changed)

public:
    static inline const QString kDefaultBaseUrl = QStringLiteral("https://stockeasy.birdra1n.com");

    explicit StockEasy(QObject *parent);

    bool enabled() const;
    QString baseUrl() const;
    QString selectedStore() const;
    bool hasApiKey() const;
    bool needsReauth() const;

    void setEnabled(bool v);
    void setBaseUrl(const QString &v);
    void setSelectedStore(const QString &v);
    Q_INVOKABLE void setApiKey(const QString &key);
    Q_INVOKABLE void clearApiKey();

    // callback({ok, product} | {ok:false, error})
    Q_INVOKABLE void lookup(const QString &reference, QJSValue callback);

signals:
    void changed();

private:
    QJsonObject section() const;
    void writeSection(const QJsonObject &se);
    QNetworkAccessManager *m_net = nullptr;
};
