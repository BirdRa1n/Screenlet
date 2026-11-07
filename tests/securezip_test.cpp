// Round-trip tests for the AES-256 (WinZip AE-2) backup archive.
//   securezip_test <work-dir>
#include "core/SecureZip.h"

#include <QCoreApplication>
#include <QCryptographicHash>
#include <QDir>
#include <QFile>
#include <QRandomGenerator>

#include <cstdio>

static int failures = 0;
#define CHECK(cond, msg)                                                  \
    do {                                                                  \
        if (cond) std::printf("ok   - %s\n", msg);                        \
        else { std::printf("FAIL - %s\n", msg); ++failures; }             \
    } while (0)

static QByteArray sha(const QString &path)
{
    QFile f(path);
    if (!f.open(QIODevice::ReadOnly)) return {};
    QCryptographicHash h(QCryptographicHash::Sha256);
    h.addData(&f);
    return h.result();
}

int main(int argc, char **argv)
{
    QCoreApplication app(argc, argv);
    const QString dir = argc > 1 ? QString::fromLocal8Bit(argv[1]) : QDir::tempPath() + QStringLiteral("/securezip-test");
    QDir(dir).removeRecursively();
    QDir().mkpath(dir + QStringLiteral("/src"));

    // A "big" binary file spanning several 1 MiB chunks + odd tail, and a JSON.
    const QString big = dir + QStringLiteral("/src/video.bin");
    {
        QFile f(big);
        if (!f.open(QIODevice::WriteOnly)) return 2;
        QByteArray buf(3 * 1024 * 1024 + 12345, Qt::Uninitialized);
        QRandomGenerator(42).fillRange(reinterpret_cast<quint32 *>(buf.data()), buf.size() / 4);
        f.write(buf);
    }
    const QByteArray json = R"({"stockeasy":{"apiKey":"sk_live_123"}})";
    const QString zipPath = dir + QStringLiteral("/backup.zip");
    const QString password = QStringLiteral("senha-forte-123");

    {
        SecureZipWriter w;
        bool ok = w.open(zipPath, password);
        ok = ok && w.addPlain(QStringLiteral("manifest.json"), R"({"encrypted":true})");
        ok = ok && w.addFile(QStringLiteral("exports/vídeo ação.bin"), big);
        ok = ok && w.addData(QStringLiteral("_secrets/secrets.json"), json);
        ok = ok && w.close();
        CHECK(ok, "write AES archive");
    }

    SecureZipReader r;
    CHECK(r.open(zipPath), "open archive");
    CHECK(r.entries().size() == 3, "3 entries listed");
    CHECK(r.hasEncryptedEntries(), "has encrypted entries");
    CHECK(r.checkPassword(password), "correct password accepted");
    CHECK(!r.checkPassword(QStringLiteral("errada")), "wrong password rejected");

    QString err;
    CHECK(r.read(QStringLiteral("manifest.json"), QString(), &err) == R"({"encrypted":true})", "plain manifest readable without password");
    CHECK(r.read(QStringLiteral("_secrets/secrets.json"), password, &err) == json, "secrets decrypt to the original");
    CHECK(r.read(QStringLiteral("_secrets/secrets.json"), QStringLiteral("errada"), &err).isEmpty(), "secrets refuse wrong password");

    const QString out = dir + QStringLiteral("/out/video.bin");
    bool extracted = false;
    for (const auto &e : r.entries())
        if (e.name == QStringLiteral("exports/vídeo ação.bin"))
            extracted = r.extract(e, password, out, &err);
    CHECK(extracted && sha(out) == sha(big), "multi-chunk file round-trips byte-identical (UTF-8 name)");

    // Tamper with one ciphertext byte → HMAC must catch it.
    {
        QFile f(zipPath);
        if (!f.open(QIODevice::ReadWrite)) return 2;
        f.seek(f.size() / 2);
        char c;
        f.getChar(&c);
        f.seek(f.size() / 2);
        f.putChar(char(c ^ 0x5A));
    }
    SecureZipReader r2;
    r2.open(zipPath);
    bool tamperedOk = true;
    for (const auto &e : r2.entries())
        if (e.name.startsWith(QStringLiteral("exports/")))
            tamperedOk = r2.extract(e, password, dir + QStringLiteral("/out/tampered.bin"), &err);
    CHECK(!tamperedOk, "tampered data rejected by HMAC");
    CHECK(!QFile::exists(dir + QStringLiteral("/out/tampered.bin")), "no partial file left after rejection");

    std::printf("%s (%d failure%s)\n", failures ? "FAILED" : "PASSED", failures, failures == 1 ? "" : "s");
    return failures ? 1 : 0;
}
