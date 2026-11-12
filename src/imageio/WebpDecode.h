#pragma once

#include <QByteArray>
#include <QImage>
#include <QSize>

// WebP decoding with the bundled libwebp, so WebP images don't depend on an
// OS codec (on Windows, WIC only reads WebP when the "WebP Image Extensions"
// Store package is installed and working).
namespace WebpDecode {

// True when the bytes start with a RIFF/WEBP header.
bool isWebp(const QByteArray &header);

// Canvas size from the header; invalid when the data isn't WebP.
QSize size(const QByteArray &data);

// Decodes the image (first frame of an animation) as premultiplied ARGB32.
// A valid, non-empty scaledSize decodes straight to that size.
bool decode(const QByteArray &data, const QSize &scaledSize, QImage *out);

} // namespace WebpDecode
