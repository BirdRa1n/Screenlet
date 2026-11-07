#include "Updater.h"

#include <QDesktopServices>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QRegularExpression>
#include <QUrl>

Updater::Updater(QObject *parent)
    : QObject(parent), m_net(new QNetworkAccessManager(this))
{
    registerInstance();
}

// Semver-ish compare; a prerelease ("1.0.0-beta.2") sorts before its release.
int Updater::compareVersions(const QString &a, const QString &b)
{
    auto split = [](QString v) {
        if (v.startsWith(QLatin1Char('v')))
            v.remove(0, 1);
        const int dash = int(v.indexOf(QLatin1Char('-')));
        return std::pair<QString, QString>(dash < 0 ? v : v.left(dash), dash < 0 ? QString() : v.mid(dash + 1));
    };
    const auto [ca, pa] = split(a);
    const auto [cb, pb] = split(b);
    const QStringList xa = ca.split(QLatin1Char('.'));
    const QStringList xb = cb.split(QLatin1Char('.'));
    for (int i = 0; i < std::max(xa.size(), xb.size()); ++i) {
        const int d = xa.value(i).toInt() - xb.value(i).toInt();
        if (d != 0)
            return d < 0 ? -1 : 1;
    }
    if (pa.isEmpty() != pb.isEmpty())
        return pa.isEmpty() ? 1 : -1;
    return QString::compare(pa, pb);
}

bool Updater::updateAvailable() const
{
    return !m_latest.isEmpty() && compareVersions(m_latest, QStringLiteral(SCREENLET_VERSION)) > 0;
}

void Updater::check(bool manual)
{
    QNetworkRequest req(QUrl(QStringLiteral("https://api.github.com/repos/BirdRa1n/Screenlet/releases?per_page=10")));
    req.setRawHeader("Accept", "application/vnd.github+json");
    req.setRawHeader("User-Agent", "Screenlet-Updater");
    req.setTransferTimeout(10000);
    QNetworkReply *reply = m_net->get(req);
    connect(reply, &QNetworkReply::finished, this, [this, reply, manual] {
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError) {
            emit checked(manual, false);
            return;
        }
        QString best;
        QString url;
        for (const auto &v : QJsonDocument::fromJson(reply->readAll()).array()) {
            const QJsonObject r = v.toObject();
            if (r.value(QStringLiteral("draft")).toBool())
                continue;
            const QString tag = r.value(QStringLiteral("tag_name")).toString();
            if (best.isEmpty() || compareVersions(tag, best) > 0) {
                best = tag;
                url = r.value(QStringLiteral("html_url")).toString();
            }
        }
        if (best.startsWith(QLatin1Char('v')))
            best.remove(0, 1);
        m_latest = best;
        m_url = url;
        emit changed();
        emit checked(manual, updateAvailable());
    });
}

void Updater::openRelease() const
{
    if (!m_url.isEmpty())
        QDesktopServices::openUrl(QUrl(m_url));
}
