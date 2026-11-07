#include "Channels.h"

#include "core/JsonIo.h"
#include "core/Paths.h"
#include "net/Kodi.h"

#include <QDir>
#include <QFile>

namespace {
int toMinutes(const QString &hhmm)
{
    const QStringList p = hhmm.split(QLatin1Char(':'));
    return p.value(0).toInt() * 60 + p.value(1).toInt();
}

bool matches(const QJsonObject &schedule, const QDateTime &now)
{
    const QString type = schedule.value(QStringLiteral("type")).toString();
    if (type == QLatin1String("always"))
        return true;
    if (type == QLatin1String("day-of-week")) {
        const int dow = now.date().dayOfWeek() % 7; // Qt: Mon=1..Sun=7 → JS: Sun=0
        for (const auto &d : schedule.value(QStringLiteral("days")).toArray())
            if (d.toInt() == dow)
                return true;
        return false;
    }
    if (type == QLatin1String("time-range")) {
        const int cur = now.time().hour() * 60 + now.time().minute();
        const int start = toMinutes(schedule.value(QStringLiteral("startTime")).toString());
        const int end = toMinutes(schedule.value(QStringLiteral("endTime")).toString());
        if (start <= end)
            return cur >= start && cur <= end;
        return cur >= start || cur <= end; // overnight (22:00–06:00)
    }
    return false;
}

QJsonValue playbackSignature(const QJsonObject &c)
{
    return QJsonArray{c.value(QStringLiteral("playlist")), c.value(QStringLiteral("rules")),
                      c.value(QStringLiteral("loop")), c.value(QStringLiteral("enabled"))};
}
} // namespace

Channels::Channels(QObject *parent)
    : QObject(parent)
{
    registerInstance();
    refresh();
}

QString Channels::fileFor(const QString &id) const
{
    return QDir(Paths::channels()).filePath(Paths::safeName(id) + QStringLiteral(".json"));
}

QList<QJsonObject> Channels::all() const { return JsonIo::readDir(Paths::channels()); }

void Channels::refresh()
{
    QVariantList list;
    for (const QJsonObject &o : all())
        list.append(o.toVariantMap());
    m_items = JsonIo::sortedByDate(list, QStringLiteral("createdAt"), false);
    emit itemsChanged();
}

QVariantMap Channels::find(const QString &id) const
{
    return JsonIo::readObject(fileFor(id)).toVariantMap();
}

QVariantMap Channels::blank() const
{
    const QString now = JsonIo::nowIso();
    return QJsonObject{
        {QStringLiteral("id"), JsonIo::newUuid()},
        {QStringLiteral("name"), QString()},
        {QStringLiteral("description"), QString()},
        {QStringLiteral("logo"), QString()},
        {QStringLiteral("enabled"), true},
        {QStringLiteral("playlist"), QJsonArray()},
        {QStringLiteral("loop"), true},
        {QStringLiteral("rules"), QJsonArray()},
        {QStringLiteral("createdAt"), now},
        {QStringLiteral("updatedAt"), now},
    }.toVariantMap();
}

QVariantMap Channels::save(const QVariantMap &channel)
{
    QJsonObject c = QJsonObject::fromVariantMap(channel);
    QString id = c.value(QStringLiteral("id")).toString();
    if (id.isEmpty()) {
        id = JsonIo::newUuid();
        c.insert(QStringLiteral("id"), id);
    }
    const QJsonObject before = JsonIo::readObject(fileFor(id));
    if (!c.contains(QStringLiteral("createdAt")))
        c.insert(QStringLiteral("createdAt"), before.value(QStringLiteral("createdAt")).toString(JsonIo::nowIso()));
    c.insert(QStringLiteral("updatedAt"), JsonIo::nowIso());
    JsonIo::write(fileFor(id), c);
    refresh();
    if (before.isEmpty() || playbackSignature(before) != playbackSignature(c)) {
        Kodi::instance()->restartForChannel(id);
        emit contentChanged(id);
    }
    return c.toVariantMap();
}

void Channels::remove(const QString &id)
{
    QFile::remove(fileFor(id));
    refresh();
}

QString Channels::activeRuleAsset(const QJsonObject &channel, const QDateTime &now)
{
    for (const auto &r : channel.value(QStringLiteral("rules")).toArray()) {
        const QJsonObject rule = r.toObject();
        if (matches(rule.value(QStringLiteral("schedule")).toObject(), now))
            return rule.value(QStringLiteral("assetFilename")).toString();
    }
    return {};
}

QString Channels::currentAssetAt(const QJsonObject &channel, const QDateTime &now)
{
    const QString rule = activeRuleAsset(channel, now);
    if (!rule.isEmpty())
        return rule;
    const QJsonArray pl = channel.value(QStringLiteral("playlist")).toArray();
    return pl.isEmpty() ? QString() : pl.first().toObject().value(QStringLiteral("filename")).toString();
}

QString Channels::currentAsset(const QVariantMap &channel) const
{
    return currentAssetAt(QJsonObject::fromVariantMap(channel), QDateTime::currentDateTime());
}

bool Channels::usesAsset(const QJsonObject &channel, const QString &filename)
{
    for (const auto &it : channel.value(QStringLiteral("playlist")).toArray())
        if (it.toObject().value(QStringLiteral("filename")).toString() == filename)
            return true;
    for (const auto &r : channel.value(QStringLiteral("rules")).toArray())
        if (r.toObject().value(QStringLiteral("assetFilename")).toString() == filename)
            return true;
    return false;
}

QVariantList Channels::channelsUsing(const QString &filename) const
{
    QVariantList out;
    for (const QVariant &v : m_items) {
        const QJsonObject c = QJsonObject::fromVariantMap(v.toMap());
        if (usesAsset(c, filename))
            out.append(QVariantMap{{QStringLiteral("id"), c.value(QStringLiteral("id"))},
                                   {QStringLiteral("name"), c.value(QStringLiteral("name"))},
                                   {QStringLiteral("enabled"), c.value(QStringLiteral("enabled")).toBool(true)}});
    }
    return out;
}

QVariantList Channels::resyncChannelsUsing(const QString &filename)
{
    QVariantList affected;
    for (QJsonObject c : all()) {
        if (!usesAsset(c, filename))
            continue;
        c.insert(QStringLiteral("updatedAt"), JsonIo::nowIso());
        const QString id = c.value(QStringLiteral("id")).toString();
        JsonIo::write(fileFor(id), c);
        Kodi::instance()->restartForChannel(id);
        emit contentChanged(id);
        affected.append(QVariantMap{{QStringLiteral("id"), id}, {QStringLiteral("name"), c.value(QStringLiteral("name"))}});
    }
    refresh();
    return affected;
}
