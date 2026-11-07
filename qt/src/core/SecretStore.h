#pragma once

#include <QString>

// OS-backed secret storage for device passwords, API keys and player tokens.
//
// `protect()` returns an opaque token that is safe to write into JSON; the
// plaintext never touches disk:
//   macOS   "kc:<uuid>"   — the secret lives in the login Keychain
//   Windows "dp:<base64>" — DPAPI blob bound to the Windows user
//   other   "b64:<base64>" — NOT encrypted (no secret service); logged
//
// Electron's safeStorage blobs (`*_enc` fields) cannot be read here: they are
// keyed by Electron's own Keychain entry. Callers treat them as "needs
// re-entry" instead of failing.
namespace SecretStore {

QString protect(const QString &plaintext);
QString unprotect(const QString &token);
void remove(const QString &token);
bool isSecure();

// Platform hooks (SecretStore_mac.mm on macOS).
bool platformStore(const QString &account, const QString &secret);
QString platformLoad(const QString &account);
void platformRemove(const QString &account);

} // namespace SecretStore
