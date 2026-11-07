#include "SecretStore.h"

#include <QByteArray>
#include <QLoggingCategory>
#include <QUuid>

#ifdef Q_OS_WIN
#include <windows.h>
#include <dpapi.h>
#endif

Q_LOGGING_CATEGORY(lcSecrets, "screenlet.secrets")

namespace SecretStore {

#if !defined(Q_OS_MACOS)
bool platformStore(const QString &, const QString &) { return false; }
QString platformLoad(const QString &) { return {}; }
void platformRemove(const QString &) {}
#endif

bool isSecure()
{
#if defined(Q_OS_MACOS) || defined(Q_OS_WIN)
    return true;
#else
    return false;
#endif
}

QString protect(const QString &plaintext)
{
    if (plaintext.isEmpty())
        return {};
#if defined(Q_OS_MACOS)
    const QString account = QUuid::createUuid().toString(QUuid::WithoutBraces);
    if (platformStore(account, plaintext))
        return QStringLiteral("kc:") + account;
    qCWarning(lcSecrets) << "Keychain write failed; secret not stored";
    return {};
#elif defined(Q_OS_WIN)
    const QByteArray in = plaintext.toUtf8();
    DATA_BLOB input{static_cast<DWORD>(in.size()), reinterpret_cast<BYTE *>(const_cast<char *>(in.data()))};
    DATA_BLOB output{};
    if (!CryptProtectData(&input, L"Screenlet", nullptr, nullptr, nullptr, 0, &output))
        return {};
    const QByteArray blob(reinterpret_cast<const char *>(output.pbData), static_cast<int>(output.cbData));
    LocalFree(output.pbData);
    return QStringLiteral("dp:") + QString::fromLatin1(blob.toBase64());
#else
    qCWarning(lcSecrets) << "No secret service available; storing secret base64-encoded only";
    return QStringLiteral("b64:") + QString::fromLatin1(plaintext.toUtf8().toBase64());
#endif
}

QString unprotect(const QString &token)
{
    if (token.startsWith(QLatin1String("kc:")))
        return platformLoad(token.mid(3));
#if defined(Q_OS_WIN)
    if (token.startsWith(QLatin1String("dp:"))) {
        QByteArray blob = QByteArray::fromBase64(token.mid(3).toLatin1());
        DATA_BLOB input{static_cast<DWORD>(blob.size()), reinterpret_cast<BYTE *>(blob.data())};
        DATA_BLOB output{};
        if (!CryptUnprotectData(&input, nullptr, nullptr, nullptr, nullptr, 0, &output))
            return {};
        const QString s = QString::fromUtf8(reinterpret_cast<const char *>(output.pbData), static_cast<int>(output.cbData));
        LocalFree(output.pbData);
        return s;
    }
#endif
    if (token.startsWith(QLatin1String("b64:")))
        return QString::fromUtf8(QByteArray::fromBase64(token.mid(4).toLatin1()));
    return {};
}

void remove(const QString &token)
{
    if (token.startsWith(QLatin1String("kc:")))
        platformRemove(token.mid(3));
}

} // namespace SecretStore
