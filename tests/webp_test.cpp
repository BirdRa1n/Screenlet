// Decoding tests for the bundled libwebp path (WebpDecode), used on Windows.
//   webp_test
#include "WebpDecode.h"

#include <QGuiApplication>
#include <QImage>

#include <webp/encode.h>

#include <cstdio>

static int failures = 0;
#define CHECK(cond, msg)                                                  \
    do {                                                                  \
        if (cond) std::printf("ok   - %s\n", msg);                        \
        else { std::printf("FAIL - %s\n", msg); ++failures; }             \
    } while (0)

static QByteArray encode(const QImage &src, bool lossless)
{
    const QImage img = src.convertToFormat(QImage::Format_ARGB32); // BGRA in memory (little-endian)
    uint8_t *out = nullptr;
    const size_t n = lossless
        ? WebPEncodeLosslessBGRA(img.constBits(), img.width(), img.height(), int(img.bytesPerLine()), &out)
        : WebPEncodeBGRA(img.constBits(), img.width(), img.height(), int(img.bytesPerLine()), 90.f, &out);
    QByteArray bytes(reinterpret_cast<const char *>(out), qsizetype(n));
    WebPFree(out);
    return bytes;
}

int main(int argc, char **argv)
{
    QGuiApplication app(argc, argv);

    QImage src(37, 23, QImage::Format_ARGB32);
    for (int y = 0; y < src.height(); ++y)
        for (int x = 0; x < src.width(); ++x)
            src.setPixel(x, y, qRgba(x * 7, y * 11, (x + y) * 5, 255));
    src.setPixel(0, 0, qRgba(0, 0, 0, 0)); // one transparent pixel
    const QImage srcPm = src.convertToFormat(QImage::Format_ARGB32_Premultiplied);

    const QByteArray lossless = encode(src, true);
    CHECK(!lossless.isEmpty(), "encode lossless");
    CHECK(WebpDecode::isWebp(lossless), "isWebp on RIFF/WEBP");
    CHECK(!WebpDecode::isWebp(QByteArray("\x89PNG\r\n\x1a\n0000", 12)), "isWebp rejects PNG");
    CHECK(WebpDecode::size(lossless) == src.size(), "size from full data");
    CHECK(WebpDecode::size(lossless.left(64)) == src.size(), "size from 64-byte header");

    QImage out;
    CHECK(WebpDecode::decode(lossless, {}, &out), "decode lossless");
    CHECK(out.size() == src.size(), "decoded size");
    CHECK(out.format() == QImage::Format_ARGB32_Premultiplied, "decoded format");
    bool same = !out.isNull();
    for (int y = 0; y < src.height() && same; ++y)
        for (int x = 0; x < src.width() && same; ++x)
            same = out.pixel(x, y) == srcPm.pixel(x, y);
    CHECK(same, "lossless pixels match (premultiplied, BGRA order)");
    CHECK(!out.isNull() && qAlpha(out.pixel(0, 0)) == 0 && qAlpha(out.pixel(1, 0)) == 255, "alpha preserved");

    QImage scaled;
    CHECK(WebpDecode::decode(lossless, QSize(74, 46), &scaled) && scaled.size() == QSize(74, 46), "scaled decode");

    const QByteArray lossy = encode(src, false);
    QImage lossyOut;
    const bool lossyOk = WebpDecode::decode(lossy, {}, &lossyOut) && lossyOut.size() == src.size();
    CHECK(lossyOk, "decode lossy");
    if (lossyOk) {
        const QRgb p = lossyOut.pixel(20, 10), q = src.pixel(20, 10);
        CHECK(qAbs(qRed(p) - qRed(q)) < 24 && qAbs(qGreen(p) - qGreen(q)) < 24 && qAbs(qBlue(p) - qBlue(q)) < 24,
              "lossy colors close (channel order)");
    }

    QImage bad;
    CHECK(!WebpDecode::decode(lossless.left(lossless.size() / 2), {}, &bad), "truncated data fails");
    CHECK(!WebpDecode::decode(QByteArray("not an image"), {}, &bad), "garbage fails");

    std::printf("%s\n", failures ? "FAILED" : "all passed");
    return failures ? 1 : 0;
}
