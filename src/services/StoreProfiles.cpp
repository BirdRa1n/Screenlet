#include "StoreProfiles.h"

#include "core/JsonIo.h"
#include "core/Paths.h"

StoreProfiles::StoreProfiles(QObject *parent)
    : QObject(parent)
{
    registerInstance();
    const QJsonObject o = JsonIo::readObject(Paths::storeProfilesFile());
    m_items = o.value(QStringLiteral("profiles")).toArray().toVariantList();
    m_activeId = o.value(QStringLiteral("activeId")).toString();
}

QVariantMap StoreProfiles::active() const
{
    for (const QVariant &v : m_items)
        if (v.toMap().value(QStringLiteral("id")).toString() == m_activeId)
            return v.toMap();
    return m_items.isEmpty() ? QVariantMap() : m_items.first().toMap();
}

QVariantMap StoreProfiles::upsert(const QVariantMap &profile)
{
    const QString name = profile.value(QStringLiteral("name")).toString().trimmed();
    if (name.isEmpty())
        return profile;
    const QString id = profile.value(QStringLiteral("id")).toString();
    int idx = -1;
    for (int i = 0; i < m_items.size(); ++i) {
        const QVariantMap p = m_items.at(i).toMap();
        if ((!id.isEmpty() && p.value(QStringLiteral("id")).toString() == id)
            || (id.isEmpty() && p.value(QStringLiteral("name")).toString().trimmed().compare(name, Qt::CaseInsensitive) == 0)) {
            idx = i;
            break;
        }
    }
    QVariantMap result = idx >= 0 ? m_items.at(idx).toMap() : QVariantMap{{QStringLiteral("id"), JsonIo::newUuid()}};
    result.insert(QStringLiteral("name"), name);
    result.insert(QStringLiteral("logoPath"), profile.value(QStringLiteral("logoPath")).toString());
    result.insert(QStringLiteral("brandColor"), profile.value(QStringLiteral("brandColor")).toString());
    if (idx >= 0)
        m_items[idx] = result;
    else
        m_items.append(result);
    if (m_activeId.isEmpty())
        m_activeId = result.value(QStringLiteral("id")).toString();
    persist();
    return result;
}

void StoreProfiles::remove(const QString &id)
{
    for (int i = m_items.size() - 1; i >= 0; --i)
        if (m_items.at(i).toMap().value(QStringLiteral("id")).toString() == id)
            m_items.removeAt(i);
    if (m_activeId == id)
        m_activeId.clear();
    persist();
}

void StoreProfiles::setActive(const QString &id)
{
    m_activeId = id;
    persist();
}

void StoreProfiles::persist()
{
    JsonIo::write(Paths::storeProfilesFile(),
                  QJsonObject{{QStringLiteral("profiles"), QJsonArray::fromVariantList(m_items)},
                              {QStringLiteral("activeId"), m_activeId}});
    emit itemsChanged();
}
