#include "StockEasy.h"

#include "core/Async.h"
#include "core/JsonIo.h"
#include "core/Paths.h"
#include "core/SecretStore.h"

#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QUrlQuery>

namespace {
const QString kKey = QStringLiteral("apiKey_secret");
}

StockEasy::StockEasy(QObject *parent)
    : QObject(parent), m_net(new QNetworkAccessManager(this))
{
    registerInstance();
}

QJsonObject StockEasy::section() const
{
    return JsonIo::readObject(Paths::integrationsFile()).value(QStringLiteral("stockeasy")).toObject();
}

void StockEasy::writeSection(const QJsonObject &se)
{
    QJsonObject root = JsonIo::readObject(Paths::integrationsFile());
    root.insert(QStringLiteral("stockeasy"), se);
    JsonIo::write(Paths::integrationsFile(), root);
    emit changed();
}

bool StockEasy::enabled() const { return section().value(QStringLiteral("enabled")).toBool(); }
QString StockEasy::baseUrl() const
{
    const QString v = section().value(QStringLiteral("baseUrl")).toString();
    return v.isEmpty() ? kDefaultBaseUrl : v;
}
QString StockEasy::selectedStore() const { return section().value(QStringLiteral("selectedStore")).toString(); }
bool StockEasy::hasApiKey() const { return !section().value(kKey).toString().isEmpty(); }
bool StockEasy::needsReauth() const
{
    return !hasApiKey() && !section().value(QStringLiteral("apiKey_enc")).toString().isEmpty();
}

void StockEasy::setEnabled(bool v)
{
    QJsonObject se = section();
    se.insert(QStringLiteral("enabled"), v);
    writeSection(se);
}

void StockEasy::setBaseUrl(const QString &v)
{
    QString url = v.trimmed();
    while (url.endsWith(QLatin1Char('/')))
        url.chop(1);
    if (url.isEmpty())
        return;
    QJsonObject se = section();
    se.insert(QStringLiteral("baseUrl"), url);
    writeSection(se);
}

void StockEasy::setSelectedStore(const QString &v)
{
    QJsonObject se = section();
    if (v.isEmpty())
        se.insert(QStringLiteral("selectedStore"), QJsonValue::Null);
    else
        se.insert(QStringLiteral("selectedStore"), v);
    writeSection(se);
}

void StockEasy::setApiKey(const QString &key)
{
    if (key.trimmed().isEmpty())
        return;
    QJsonObject se = section();
    SecretStore::remove(se.value(kKey).toString());
    se.insert(kKey, SecretStore::protect(key.trimmed()));
    se.remove(QStringLiteral("apiKey_enc"));
    writeSection(se);
}

void StockEasy::clearApiKey()
{
    QJsonObject se = section();
    SecretStore::remove(se.value(kKey).toString());
    se.remove(kKey);
    se.remove(QStringLiteral("apiKey_enc"));
    writeSection(se);
}

void StockEasy::lookup(const QString &reference, QJSValue cb)
{
    const QJsonObject se = section();
    if (!se.value(QStringLiteral("enabled")).toBool()) {
        Async::invoke(cb, Async::fail(QStringLiteral("Integração StockEasy desativada.")));
        return;
    }
    const QString key = SecretStore::unprotect(se.value(kKey).toString());
    if (key.isEmpty()) {
        Async::invoke(cb, Async::fail(QStringLiteral("Chave de API não configurada.")));
        return;
    }
    const QString ref = reference.trimmed();
    if (ref.isEmpty()) {
        Async::invoke(cb, Async::fail(QStringLiteral("Produto sem referência.")));
        return;
    }
    QUrl url(baseUrl() + QStringLiteral("/api/v1/products"));
    QUrlQuery q;
    q.addQueryItem(QStringLiteral("codigo"), ref);
    url.setQuery(q);
    QNetworkRequest req(url);
    req.setRawHeader("x-api-key", key.toUtf8());
    req.setTransferTimeout(15000);
    QNetworkReply *reply = m_net->get(req);
    connect(reply, &QNetworkReply::finished, this, [reply, cb] {
        reply->deleteLater();
        const int status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        if (status == 401) {
            Async::invoke(cb, Async::fail(QStringLiteral("Chave de API inválida.")));
            return;
        }
        if (status == 404) {
            Async::invoke(cb, Async::fail(QStringLiteral("Nenhum produto encontrado.")));
            return;
        }
        if (reply->error() != QNetworkReply::NoError && status == 0) {
            Async::invoke(cb, Async::fail(QStringLiteral("Falha ao contatar o StockEasy: %1").arg(reply->errorString())));
            return;
        }
        if (status < 200 || status >= 300) {
            Async::invoke(cb, Async::fail(QStringLiteral("StockEasy respondeu %1.").arg(status)));
            return;
        }
        const QJsonDocument doc = QJsonDocument::fromJson(reply->readAll());
        Async::invoke(cb, Async::ok({{QStringLiteral("product"), doc.object().toVariantMap()}}));
    });
}
