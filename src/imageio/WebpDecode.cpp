#include "WebpDecode.h"

#include <webp/decode.h>
#include <webp/demux.h>

#include <cstring>

namespace WebpDecode {

bool isWebp(const QByteArray &h)
{
    return h.size() >= 12 && h.startsWith("RIFF") && std::memcmp(h.constData() + 8, "WEBP", 4) == 0;
}

QSize size(const QByteArray &data)
{
    WebPBitstreamFeatures f;
    if (WebPGetFeatures(reinterpret_cast<const uint8_t *>(data.constData()), size_t(data.size()), &f) != VP8_STATUS_OK)
        return {};
    if (f.width <= 0 || f.height <= 0)
        return {};
    return QSize(f.width, f.height);
}

namespace {
bool wantsScale(const QSize &scaled, int w, int h)
{
    return scaled.isValid() && !scaled.isEmpty() && (scaled.width() != w || scaled.height() != h);
}

// Animated WebP: composite the first frame onto the full canvas.
bool decodeAnimated(const QByteArray &data, const QSize &scaledSize, QImage *out)
{
    WebPData wd{reinterpret_cast<const uint8_t *>(data.constData()), size_t(data.size())};
    WebPAnimDecoderOptions opts;
    if (!WebPAnimDecoderOptionsInit(&opts))
        return false;
    opts.color_mode = MODE_bgrA; // premultiplied BGRA = Format_ARGB32_Premultiplied (little-endian)
    opts.use_threads = 0;
    WebPAnimDecoder *dec = WebPAnimDecoderNew(&wd, &opts);
    if (!dec)
        return false;
    bool ok = false;
    WebPAnimInfo info;
    uint8_t *buf = nullptr;
    int timestamp = 0;
    if (WebPAnimDecoderGetInfo(dec, &info) && info.canvas_width > 0 && info.canvas_height > 0
        && WebPAnimDecoderGetNext(dec, &buf, &timestamp) && buf) {
        const int w = int(info.canvas_width), h = int(info.canvas_height);
        // buf is owned by the decoder: copy it out before deleting.
        QImage img = QImage(buf, w, h, w * 4, QImage::Format_ARGB32_Premultiplied).copy();
        if (!img.isNull()) {
            if (wantsScale(scaledSize, w, h))
                img = img.scaled(scaledSize, Qt::IgnoreAspectRatio, Qt::SmoothTransformation);
            *out = img;
            ok = true;
        }
    }
    WebPAnimDecoderDelete(dec);
    return ok;
}
} // namespace

bool decode(const QByteArray &data, const QSize &scaledSize, QImage *out)
{
    const auto *bytes = reinterpret_cast<const uint8_t *>(data.constData());
    const size_t len = size_t(data.size());

    WebPDecoderConfig config;
    if (!WebPInitDecoderConfig(&config))
        return false;
    if (WebPGetFeatures(bytes, len, &config.input) != VP8_STATUS_OK)
        return false;
    if (config.input.has_animation)
        return decodeAnimated(data, scaledSize, out);

    int w = config.input.width, h = config.input.height;
    if (w <= 0 || h <= 0)
        return false;
    if (wantsScale(scaledSize, w, h)) {
        config.options.use_scaling = 1;
        config.options.scaled_width = scaledSize.width();
        config.options.scaled_height = scaledSize.height();
        w = scaledSize.width();
        h = scaledSize.height();
    }

    QImage img(w, h, QImage::Format_ARGB32_Premultiplied);
    if (img.isNull())
        return false;
    // Decode straight into the QImage buffer.
    config.output.colorspace = MODE_bgrA;
    config.output.is_external_memory = 1;
    config.output.u.RGBA.rgba = img.bits();
    config.output.u.RGBA.stride = int(img.bytesPerLine());
    config.output.u.RGBA.size = size_t(img.sizeInBytes());
    const bool ok = WebPDecode(bytes, len, &config) == VP8_STATUS_OK;
    WebPFreeDecBuffer(&config.output);
    if (!ok)
        return false;
    *out = img;
    return true;
}

} // namespace WebpDecode
