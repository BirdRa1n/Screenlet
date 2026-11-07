#pragma once

#include <QByteArray>
#include <QFile>
#include <QList>
#include <QString>

// Password-protected ZIP using WinZip AES-256 encryption (AE-2), the format
// 7-Zip, Keka, The Unarchiver, WinRAR and recent Windows read. Entries are
// STORED (backups are mostly already-compressed images/videos) and written
// in chunks, so multi-GB videos never sit in memory.
//
//   PBKDF2-HMAC-SHA1(password, 16-byte salt, 1000) → 32B AES key, 32B HMAC
//   key, 2B verifier · AES-256-CTR (little-endian counter from 1) ·
//   HMAC-SHA1 over the ciphertext, truncated to 10 bytes.
//
// Plain (unencrypted) entries can be mixed in — used for manifest.json so the
// app can show what a backup contains before asking for its password.
class SecureZipWriter
{
public:
    ~SecureZipWriter();
    bool open(const QString &path, const QString &password);
    bool addPlain(const QString &name, const QByteArray &data);
    bool addFile(const QString &name, const QString &sourcePath);
    bool addData(const QString &name, const QByteArray &data);
    bool close();
    QString errorString() const { return m_error; }

private:
    struct Entry {
        QByteArray name;
        quint32 crc = 0;
        quint32 size = 0;      // uncompressed
        quint32 csize = 0;     // stored size (+ AES overhead)
        quint32 offset = 0;
        quint16 method = 0;    // 0 or 99 (AES)
        quint16 flags = 0;
        quint16 dosTime = 0;
        quint16 dosDate = 0;
    };
    bool writeEncrypted(const QString &name, QIODevice *src, qint64 size);
    bool fail(const QString &e);

    QFile m_file;
    QString m_password;
    QList<Entry> m_entries;
    QString m_error;
};

class SecureZipReader
{
public:
    struct Entry {
        QString name;
        bool encrypted = false;
        quint32 size = 0;
        quint32 csize = 0;
        quint32 offset = 0;
        quint16 method = 0;    // actual method (0 stored, 8 deflate)
    };

    bool open(const QString &path);
    QList<Entry> entries() const { return m_entries; }
    bool hasEncryptedEntries() const;
    // Reads a plain or encrypted entry fully (small files: manifest, JSON).
    QByteArray read(const QString &name, const QString &password, QString *error);
    // Streams an entry to disk, verifying the password and the HMAC.
    bool extract(const Entry &e, const QString &password, const QString &destPath, QString *error);
    bool checkPassword(const QString &password);

private:
    bool readEntry(const Entry &e, const QString &password, QIODevice *out, QString *error);
    QFile m_file;
    QList<Entry> m_entries;
};
