#include "SecureZip.h"

#include <QBuffer>
#include <QDateTime>
#include <QDir>
#include <QFileInfo>
#include <QMessageAuthenticationCode>
#include <QPasswordDigestor>
#include <QRandomGenerator>
#include <QSaveFile>

#include <algorithm>
#include <cstring>

#if defined(Q_OS_MACOS)
#include <CommonCrypto/CommonCryptor.h>
#elif defined(Q_OS_WIN)
#include <windows.h>
#include <bcrypt.h>
#endif

namespace {
constexpr qint64 kChunk = 1 << 20; // 1 MiB
constexpr int kSaltLen = 16;       // AES-256
constexpr int kAuthLen = 10;
constexpr int kIterations = 1000;  // fixed by the WinZip AE spec

// ── little-endian writers ────────────────────────────────────────────────────
void put16(QByteArray &b, quint16 v) { b.append(char(v & 0xff)); b.append(char(v >> 8)); }
void put32(QByteArray &b, quint32 v) { for (int i = 0; i < 4; ++i) b.append(char((v >> (8 * i)) & 0xff)); }
quint16 get16(const uchar *p) { return quint16(p[0] | (p[1] << 8)); }
quint32 get32(const uchar *p) { return quint32(p[0]) | (quint32(p[1]) << 8) | (quint32(p[2]) << 16) | (quint32(p[3]) << 24); }

// ── CRC-32 (plain entries only; AE-2 stores CRC 0) ───────────────────────────
quint32 crc32(quint32 crc, const char *data, qint64 len)
{
    static quint32 table[256];
    static bool init = false;
    if (!init) {
        for (quint32 i = 0; i < 256; ++i) {
            quint32 c = i;
            for (int k = 0; k < 8; ++k)
                c = (c & 1) ? 0xEDB88320u ^ (c >> 1) : c >> 1;
            table[i] = c;
        }
        init = true;
    }
    crc = ~crc;
    for (qint64 i = 0; i < len; ++i)
        crc = table[(crc ^ uchar(data[i])) & 0xff] ^ (crc >> 8);
    return ~crc;
}

void dosDateTime(const QDateTime &dt, quint16 *time, quint16 *date)
{
    const QDateTime l = dt.toLocalTime();
    *time = quint16((l.time().hour() << 11) | (l.time().minute() << 5) | (l.time().second() / 2));
    *date = quint16(((std::max(1980, l.date().year()) - 1980) << 9) | (l.date().month() << 5) | l.date().day());
}

// ── AES-256-ECB over a buffer of counter blocks (→ CTR keystream) ────────────
class AesEcb
{
public:
    explicit AesEcb(const QByteArray &key)
    {
#if defined(Q_OS_MACOS)
        m_ok = CCCryptorCreate(kCCEncrypt, kCCAlgorithmAES, kCCOptionECBMode, key.constData(), size_t(key.size()), nullptr,
                               &m_ref) == kCCSuccess;
#elif defined(Q_OS_WIN)
        m_ok = BCRYPT_SUCCESS(BCryptOpenAlgorithmProvider(&m_alg, BCRYPT_AES_ALGORITHM, nullptr, 0))
               && BCRYPT_SUCCESS(BCryptSetProperty(m_alg, BCRYPT_CHAINING_MODE, (PUCHAR)BCRYPT_CHAIN_MODE_ECB,
                                                   sizeof(BCRYPT_CHAIN_MODE_ECB), 0))
               && BCRYPT_SUCCESS(BCryptGenerateSymmetricKey(m_alg, &m_key, nullptr, 0, (PUCHAR)key.constData(), ULONG(key.size()), 0));
#else
        Q_UNUSED(key)
#endif
    }
    ~AesEcb()
    {
#if defined(Q_OS_MACOS)
        if (m_ref)
            CCCryptorRelease(m_ref);
#elif defined(Q_OS_WIN)
        if (m_key)
            BCryptDestroyKey(m_key);
        if (m_alg)
            BCryptCloseAlgorithmProvider(m_alg, 0);
#endif
    }
    bool ok() const { return m_ok; }
    bool encrypt(const char *in, char *out, qint64 len)
    {
#if defined(Q_OS_MACOS)
        size_t moved = 0;
        return CCCryptorUpdate(m_ref, in, size_t(len), out, size_t(len), &moved) == kCCSuccess && qint64(moved) == len;
#elif defined(Q_OS_WIN)
        ULONG written = 0;
        return BCRYPT_SUCCESS(BCryptEncrypt(m_key, (PUCHAR)in, ULONG(len), nullptr, nullptr, 0, (PUCHAR)out, ULONG(len), &written, 0));
#else
        Q_UNUSED(in) Q_UNUSED(out) Q_UNUSED(len)
        return false;
#endif
    }

private:
    bool m_ok = false;
#if defined(Q_OS_MACOS)
    CCCryptorRef m_ref = nullptr;
#elif defined(Q_OS_WIN)
    BCRYPT_ALG_HANDLE m_alg = nullptr;
    BCRYPT_KEY_HANDLE m_key = nullptr;
#endif
};

// WinZip CTR: 16-byte little-endian counter starting at 1.
class AesCtr
{
public:
    explicit AesCtr(const QByteArray &key) : m_aes(key) { std::memset(m_counter, 0, 16); }
    bool ok() const { return m_aes.ok(); }
    bool apply(char *data, qint64 len)
    {
        QByteArray blocks((len + 15) / 16 * 16, Qt::Uninitialized);
        for (qint64 off = 0; off < blocks.size(); off += 16) {
            for (int i = 0; i < 16; ++i) { // increment little-endian
                if (++m_counter[i] != 0)
                    break;
            }
            std::memcpy(blocks.data() + off, m_counter, 16);
        }
        if (!m_aes.encrypt(blocks.constData(), blocks.data(), blocks.size()))
            return false;
        for (qint64 i = 0; i < len; ++i)
            data[i] ^= blocks[i];
        return true;
    }

private:
    AesEcb m_aes;
    uchar m_counter[16];
};

struct Keys {
    QByteArray enc, auth, verifier;
};

Keys deriveKeys(const QString &password, const QByteArray &salt)
{
    const QByteArray k = QPasswordDigestor::deriveKeyPbkdf2(QCryptographicHash::Sha1, password.toUtf8(), salt, kIterations, 66);
    return {k.left(32), k.mid(32, 32), k.mid(64, 2)};
}

QByteArray aesExtra()
{
    QByteArray x;
    put16(x, 0x9901); // AES extra field
    put16(x, 7);
    put16(x, 2);      // AE-2
    x.append("AE", 2);
    x.append(char(3)); // AES-256
    put16(x, 0);       // actual method: stored
    return x;
}
} // namespace

// ── Writer ────────────────────────────────────────────────────────────────────

SecureZipWriter::~SecureZipWriter()
{
    if (m_file.isOpen())
        m_file.close();
}

bool SecureZipWriter::fail(const QString &e)
{
    m_error = e;
    return false;
}

bool SecureZipWriter::open(const QString &path, const QString &password)
{
    m_password = password;
    m_file.setFileName(path);
    if (!m_file.open(QIODevice::WriteOnly | QIODevice::Truncate))
        return fail(m_file.errorString());
#if !defined(Q_OS_MACOS) && !defined(Q_OS_WIN)
    if (!password.isEmpty())
        return fail(QStringLiteral("Criptografia AES indisponível nesta plataforma."));
#endif
    return true;
}

bool SecureZipWriter::addPlain(const QString &name, const QByteArray &data)
{
    if (m_file.pos() + data.size() > 0xFFFFFFF0LL)
        return fail(QStringLiteral("Backup maior que 4 GB."));
    Entry e;
    e.name = name.toUtf8();
    e.crc = crc32(0, data.constData(), data.size());
    e.size = e.csize = quint32(data.size());
    e.offset = quint32(m_file.pos());
    e.method = 0;
    e.flags = 0x0800;
    dosDateTime(QDateTime::currentDateTime(), &e.dosTime, &e.dosDate);
    QByteArray h;
    put32(h, 0x04034b50); put16(h, 20); put16(h, e.flags); put16(h, 0); put16(h, e.dosTime); put16(h, e.dosDate);
    put32(h, e.crc); put32(h, e.csize); put32(h, e.size); put16(h, quint16(e.name.size())); put16(h, 0);
    h.append(e.name);
    if (m_file.write(h) != h.size() || m_file.write(data) != data.size())
        return fail(m_file.errorString());
    m_entries.append(e);
    return true;
}

bool SecureZipWriter::addData(const QString &name, const QByteArray &data)
{
    QByteArray copy = data;
    QBuffer buf(&copy);
    buf.open(QIODevice::ReadOnly);
    return writeEncrypted(name, &buf, copy.size());
}

bool SecureZipWriter::addFile(const QString &name, const QString &sourcePath)
{
    QFile src(sourcePath);
    if (!src.open(QIODevice::ReadOnly))
        return fail(QStringLiteral("Não foi possível ler %1").arg(sourcePath));
    return writeEncrypted(name, &src, src.size());
}

bool SecureZipWriter::writeEncrypted(const QString &name, QIODevice *src, qint64 size)
{
    const qint64 csize = kSaltLen + 2 + size + kAuthLen;
    if (size > 0xFFFFFFF0LL || m_file.pos() + csize > 0xFFFFFFF0LL)
        return fail(QStringLiteral("Backup maior que 4 GB (arquivo \"%1\").").arg(name));

    QByteArray salt(kSaltLen, Qt::Uninitialized);
    QRandomGenerator::system()->fillRange(reinterpret_cast<quint32 *>(salt.data()), kSaltLen / 4);
    const Keys keys = deriveKeys(m_password, salt);
    AesCtr ctr(keys.enc);
    if (!ctr.ok())
        return fail(QStringLiteral("Falha ao iniciar a criptografia AES."));
    QMessageAuthenticationCode mac(QCryptographicHash::Sha1, keys.auth);

    Entry e;
    e.name = name.toUtf8();
    e.crc = 0;
    e.size = quint32(size);
    e.csize = quint32(csize);
    e.offset = quint32(m_file.pos());
    e.method = 99;
    e.flags = 0x0801; // encrypted + UTF-8 names
    dosDateTime(QDateTime::currentDateTime(), &e.dosTime, &e.dosDate);

    const QByteArray extra = aesExtra();
    QByteArray h;
    put32(h, 0x04034b50); put16(h, 51); put16(h, e.flags); put16(h, 99); put16(h, e.dosTime); put16(h, e.dosDate);
    put32(h, 0); put32(h, e.csize); put32(h, e.size); put16(h, quint16(e.name.size())); put16(h, quint16(extra.size()));
    h.append(e.name);
    h.append(extra);
    h.append(salt);
    h.append(keys.verifier);
    if (m_file.write(h) != h.size())
        return fail(m_file.errorString());

    QByteArray chunk;
    qint64 left = size;
    while (left > 0) {
        chunk = src->read(std::min(kChunk, left));
        if (chunk.isEmpty())
            return fail(QStringLiteral("Leitura interrompida em \"%1\".").arg(name));
        if (!ctr.apply(chunk.data(), chunk.size()))
            return fail(QStringLiteral("Falha na criptografia AES."));
        mac.addData(chunk);
        if (m_file.write(chunk) != chunk.size())
            return fail(m_file.errorString());
        left -= chunk.size();
    }
    const QByteArray auth = mac.result().left(kAuthLen);
    if (m_file.write(auth) != auth.size())
        return fail(m_file.errorString());
    m_entries.append(e);
    return true;
}

bool SecureZipWriter::close()
{
    const quint32 cdOffset = quint32(m_file.pos());
    QByteArray cd;
    const QByteArray extra = aesExtra();
    for (const Entry &e : std::as_const(m_entries)) {
        const bool aes = e.method == 99;
        put32(cd, 0x02014b50); put16(cd, 0x033F); put16(cd, aes ? 51 : 20); put16(cd, e.flags); put16(cd, e.method);
        put16(cd, e.dosTime); put16(cd, e.dosDate); put32(cd, e.crc); put32(cd, e.csize); put32(cd, e.size);
        put16(cd, quint16(e.name.size())); put16(cd, aes ? quint16(extra.size()) : 0); put16(cd, 0); put16(cd, 0); put16(cd, 0);
        put32(cd, 0100644u << 16); put32(cd, e.offset);
        cd.append(e.name);
        if (aes)
            cd.append(extra);
    }
    QByteArray eocd;
    put32(eocd, 0x06054b50); put16(eocd, 0); put16(eocd, 0);
    put16(eocd, quint16(m_entries.size())); put16(eocd, quint16(m_entries.size()));
    put32(eocd, quint32(cd.size())); put32(eocd, cdOffset); put16(eocd, 0);
    const bool ok = m_file.write(cd) == cd.size() && m_file.write(eocd) == eocd.size();
    m_file.close();
    return ok || fail(QStringLiteral("Falha ao finalizar o backup."));
}

// ── Reader ────────────────────────────────────────────────────────────────────

bool SecureZipReader::open(const QString &path)
{
    m_entries.clear();
    m_file.setFileName(path);
    if (!m_file.open(QIODevice::ReadOnly))
        return false;
    const qint64 size = m_file.size();
    const qint64 tail = std::min<qint64>(size, 65536 + 22);
    m_file.seek(size - tail);
    const QByteArray end = m_file.read(tail);
    const int pos = int(end.lastIndexOf(QByteArray("PK\x05\x06", 4)));
    if (pos < 0 || end.size() - pos < 22)
        return false;
    const auto *p = reinterpret_cast<const uchar *>(end.constData() + pos);
    const quint16 count = get16(p + 10);
    const quint32 cdSize = get32(p + 12);
    const quint32 cdOffset = get32(p + 16);
    m_file.seek(cdOffset);
    const QByteArray cd = m_file.read(cdSize);
    int i = 0;
    for (int n = 0; n < count && i + 46 <= cd.size(); ++n) {
        const auto *c = reinterpret_cast<const uchar *>(cd.constData() + i);
        if (get32(c) != 0x02014b50)
            return false;
        Entry e;
        const quint16 flags = get16(c + 8);
        const quint16 method = get16(c + 10);
        e.csize = get32(c + 20);
        e.size = get32(c + 24);
        const quint16 nameLen = get16(c + 28), extraLen = get16(c + 30), commentLen = get16(c + 32);
        e.offset = get32(c + 42);
        e.name = QString::fromUtf8(cd.mid(i + 46, nameLen));
        e.encrypted = (flags & 1) && method == 99;
        e.method = method;
        if (e.encrypted) { // actual method from the AES extra field
            const QByteArray ex = cd.mid(i + 46 + nameLen, extraLen);
            for (int j = 0; j + 4 <= ex.size();) {
                const auto *x = reinterpret_cast<const uchar *>(ex.constData() + j);
                const quint16 id = get16(x), len = get16(x + 2);
                if (id == 0x9901 && len >= 7)
                    e.method = get16(x + 9);
                j += 4 + len;
            }
        }
        if (!e.name.endsWith(QLatin1Char('/')))
            m_entries.append(e);
        i += 46 + nameLen + extraLen + commentLen;
    }
    return true;
}

bool SecureZipReader::hasEncryptedEntries() const
{
    return std::any_of(m_entries.cbegin(), m_entries.cend(), [](const Entry &e) { return e.encrypted; });
}

bool SecureZipReader::readEntry(const Entry &e, const QString &password, QIODevice *out, QString *error)
{
    auto err = [&](const QString &m) { if (error) *error = m; return false; };
    if (e.method != 0)
        return err(QStringLiteral("Formato de compressão não suportado em \"%1\".").arg(e.name));
    m_file.seek(e.offset);
    const QByteArray lh = m_file.read(30);
    if (lh.size() < 30 || get32(reinterpret_cast<const uchar *>(lh.constData())) != 0x04034b50)
        return err(QStringLiteral("Backup corrompido."));
    const auto *l = reinterpret_cast<const uchar *>(lh.constData());
    m_file.seek(e.offset + 30 + get16(l + 26) + get16(l + 28));

    if (!e.encrypted) {
        qint64 left = e.size;
        while (left > 0) {
            const QByteArray c = m_file.read(std::min(kChunk, left));
            if (c.isEmpty() || out->write(c) != c.size())
                return err(QStringLiteral("Falha ao ler \"%1\".").arg(e.name));
            left -= c.size();
        }
        return true;
    }

    const QByteArray salt = m_file.read(kSaltLen);
    const QByteArray verifier = m_file.read(2);
    const Keys keys = deriveKeys(password, salt);
    if (keys.verifier != verifier)
        return err(QStringLiteral("Senha incorreta."));
    AesCtr ctr(keys.enc);
    if (!ctr.ok())
        return err(QStringLiteral("Criptografia AES indisponível."));
    QMessageAuthenticationCode mac(QCryptographicHash::Sha1, keys.auth);
    qint64 left = qint64(e.csize) - kSaltLen - 2 - kAuthLen;
    while (left > 0) {
        QByteArray c = m_file.read(std::min(kChunk, left));
        if (c.isEmpty())
            return err(QStringLiteral("Backup truncado."));
        mac.addData(c);
        if (!ctr.apply(c.data(), c.size()) || out->write(c) != c.size())
            return err(QStringLiteral("Falha ao descriptografar \"%1\".").arg(e.name));
        left -= c.size();
    }
    if (m_file.read(kAuthLen) != mac.result().left(kAuthLen))
        return err(QStringLiteral("O arquivo \"%1\" foi alterado ou está corrompido.").arg(e.name));
    return true;
}

QByteArray SecureZipReader::read(const QString &name, const QString &password, QString *error)
{
    for (const Entry &e : std::as_const(m_entries)) {
        if (e.name != name)
            continue;
        QByteArray data;
        QBuffer buf(&data);
        buf.open(QIODevice::WriteOnly);
        return readEntry(e, password, &buf, error) ? data : QByteArray();
    }
    return {};
}

bool SecureZipReader::extract(const Entry &e, const QString &password, const QString &destPath, QString *error)
{
    QDir().mkpath(QFileInfo(destPath).absolutePath());
    QSaveFile out(destPath);
    if (!out.open(QIODevice::WriteOnly)) {
        if (error)
            *error = out.errorString();
        return false;
    }
    if (!readEntry(e, password, &out, error)) {
        out.cancelWriting();
        return false;
    }
    return out.commit();
}

bool SecureZipReader::checkPassword(const QString &password)
{
    for (const Entry &e : std::as_const(m_entries)) {
        if (!e.encrypted)
            continue;
        m_file.seek(e.offset);
        const QByteArray lh = m_file.read(30);
        if (lh.size() < 30)
            return false;
        const auto *l = reinterpret_cast<const uchar *>(lh.constData());
        m_file.seek(e.offset + 30 + get16(l + 26) + get16(l + 28));
        const QByteArray salt = m_file.read(kSaltLen);
        return deriveKeys(password, salt).verifier == m_file.read(2);
    }
    return true;
}
