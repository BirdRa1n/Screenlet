#pragma once

#include "core/AppContext.h"

#include <QJSValue>
#include <QObject>
#include <QVariantList>
#include <QtQml/qqmlregistration.h>

// Selective backup / restore (.zip + manifest.json), same format as the
// Electron build so old backups restore here and vice versa.
class Backup : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    SL_SINGLETON(Backup)
    Q_PROPERTY(QString dir READ dir NOTIFY dirChanged)
    Q_PROPERTY(bool busy READ busy NOTIFY busyChanged)

public:
    explicit Backup(QObject *parent);

    QString dir() const;
    bool busy() const { return m_busy; }

    Q_INVOKABLE QVariantList categories() const;  // [{key, label, credentials}]
    // True when the selection includes credentials → a password is mandatory.
    Q_INVOKABLE bool needsPassword(const QStringList &keys) const;
    Q_INVOKABLE bool checkPassword(const QString &zipPath, const QString &password) const;
    Q_INVOKABLE void setDir(const QString &path);
    Q_INVOKABLE void openDir() const;
    Q_INVOKABLE void list(QJSValue callback) const;
    // password non-empty → AES-256 locked zip (required with credentials).
    Q_INVOKABLE void create(const QStringList &keys, const QString &password, QJSValue callback);
    Q_INVOKABLE void remove(const QString &filename);
    Q_INVOKABLE void reveal(const QString &filename) const;
    Q_INVOKABLE QVariantMap inspect(const QString &zipPath) const;
    Q_INVOKABLE void restore(const QString &zipPath, const QStringList &keys, const QString &password, QJSValue callback);

signals:
    void dirChanged();
    void busyChanged();

private:
    void setBusy(bool b);
    bool m_busy = false;
};
