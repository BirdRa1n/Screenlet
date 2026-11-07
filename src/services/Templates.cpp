#include "Templates.h"

#include "core/JsonIo.h"
#include "core/Paths.h"

#include <QDir>
#include <QFile>

Templates::Templates(QObject *parent)
    : QObject(parent)
{
    registerInstance();
    for (const char *name : {"generico", "carnes", "natal", "pascoa"}) {
        const QString path = QStringLiteral(":/qt/qml/Screenlet/resources/templates/%1.json").arg(QLatin1String(name));
        QVariantMap t = JsonIo::readObject(path).toVariantMap();
        t.insert(QStringLiteral("builtin"), true);
        m_builtin.append(t);
    }
    refresh();
}

void Templates::refresh()
{
    QVariantList user;
    for (const QJsonObject &o : JsonIo::readDir(Paths::templates())) {
        QVariantMap t = o.toVariantMap();
        t.insert(QStringLiteral("builtin"), false);
        user.append(t);
    }
    m_items = m_builtin + JsonIo::sortedByDate(user, QStringLiteral("updatedAt"));
    emit itemsChanged();
}

QVariantMap Templates::find(const QString &id) const
{
    for (const QVariant &v : m_items) {
        const QVariantMap t = v.toMap();
        if (t.value(QStringLiteral("id")).toString() == id)
            return t;
    }
    return {};
}

bool Templates::isBuiltin(const QString &id) const
{
    for (const QVariant &v : m_builtin)
        if (v.toMap().value(QStringLiteral("id")).toString() == id)
            return true;
    return false;
}

bool Templates::save(const QVariantMap &tpl)
{
    const QString id = tpl.value(QStringLiteral("id")).toString();
    if (id.isEmpty() || isBuiltin(id))
        return false;
    QVariantMap t = tpl;
    t.remove(QStringLiteral("builtin"));
    t.insert(QStringLiteral("updatedAt"), JsonIo::nowIso());
    if (!t.contains(QStringLiteral("createdAt")))
        t.insert(QStringLiteral("createdAt"), JsonIo::nowIso());
    const bool ok = JsonIo::write(QDir(Paths::templates()).filePath(Paths::safeName(id) + QStringLiteral(".json")),
                                  QJsonObject::fromVariantMap(t));
    refresh();
    return ok;
}

void Templates::remove(const QString &id)
{
    if (isBuiltin(id))
        return;
    QFile::remove(QDir(Paths::templates()).filePath(Paths::safeName(id) + QStringLiteral(".json")));
    refresh();
}

QString Templates::duplicate(const QString &id)
{
    QVariantMap t = find(id);
    if (t.isEmpty())
        return {};
    const QString now = JsonIo::nowIso();
    const QString newId = JsonIo::newUuid();
    t.insert(QStringLiteral("id"), newId);
    t.insert(QStringLiteral("name"), t.value(QStringLiteral("name")).toString() + QStringLiteral(" (cópia)"));
    t.insert(QStringLiteral("createdAt"), now);
    t.insert(QStringLiteral("builtin"), false);
    save(t);
    return newId;
}

bool Templates::exportTo(const QString &id, const QString &localPath) const
{
    QVariantMap t = find(id);
    if (t.isEmpty())
        return false;
    t.remove(QStringLiteral("builtin"));
    return JsonIo::write(localPath, QJsonObject::fromVariantMap(t));
}

QVariantMap Templates::importFrom(const QString &localPath)
{
    bool ok = false;
    const QJsonDocument doc = JsonIo::read(localPath, &ok);
    const QJsonObject o = doc.object();
    if (!ok || !o.value(QStringLiteral("scenes")).isArray())
        return {{QStringLiteral("ok"), false}, {QStringLiteral("error"), QStringLiteral("Arquivo inválido. Use um arquivo .adframe.json.")}};
    QVariantMap t = o.toVariantMap();
    const QString now = JsonIo::nowIso();
    t.insert(QStringLiteral("id"), JsonIo::newUuid());
    t.insert(QStringLiteral("createdAt"), now);
    save(t);
    return {{QStringLiteral("ok"), true}, {QStringLiteral("name"), t.value(QStringLiteral("name"))}};
}

QVariantMap Templates::blank() const
{
    const QString now = JsonIo::nowIso();
    return QJsonObject{
        {QStringLiteral("id"), JsonIo::newUuid()},
        {QStringLiteral("name"), QStringLiteral("Novo template")},
        {QStringLiteral("description"), QString()},
        {QStringLiteral("category"), QStringLiteral("Personalizado")},
        {QStringLiteral("tags"), QJsonArray{QStringLiteral("Personalizado")}},
        {QStringLiteral("thumbnail"), QString()},
        {QStringLiteral("version"), QStringLiteral("1.0.0")},
        {QStringLiteral("fps"), 30},
        {QStringLiteral("width"), 1920},
        {QStringLiteral("height"), 1080},
        {QStringLiteral("createdAt"), now},
        {QStringLiteral("updatedAt"), now},
        {QStringLiteral("variables"), QJsonArray()},
        {QStringLiteral("scenes"), QJsonArray{QJsonObject{
            {QStringLiteral("id"), JsonIo::newUuid()},
            {QStringLiteral("name"), QStringLiteral("Cena 1")},
            {QStringLiteral("durationInFrames"), 150},
            {QStringLiteral("backgroundColor"), QStringLiteral("#111318")},
            {QStringLiteral("layers"), QJsonArray()},
        }}},
    }.toVariantMap();
}

QJsonArray Templates::allAsJson() const
{
    return QJsonArray::fromVariantList(m_items);
}
