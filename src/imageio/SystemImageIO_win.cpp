#include "SystemImageIO.h"
#include "WebpDecode.h"

#include <QImage>
#include <QIODevice>
#include <QVariant>

#include <windows.h>
#include <wincodec.h>
#include <wrl/client.h>

using Microsoft::WRL::ComPtr;

// Windows: WebP is decoded with the bundled libwebp. WIC's WebP decoder is a
// Store package ("WebP Image Extensions") that may be missing, removed, or not
// usable from a desktop app, so relying on it left WebP images blank. WIC
// (Windows Imaging Component) still handles AVIF and HEIC, which need the
// AV1/HEIF extensions from the Store, and is the fallback for WebP. Without a
// codec, read() fails and QML shows its usual "image unavailable" state.

namespace {
// Sniffs the container: RIFF/WEBP, or an ISO-BMFF "ftyp" box with an
// AVIF/HEIF brand.
bool sniff(const QByteArray &h)
{
    if (h.size() >= 12 && h.startsWith("RIFF") && h.mid(8, 4) == "WEBP")
        return true;
    if (h.size() >= 12 && h.mid(4, 4) == "ftyp") {
        const QByteArray brand = h.mid(8, 4);
        return brand == "avif" || brand == "avis" || brand == "heic" || brand == "heix" || brand == "mif1" || brand == "msf1"
               || brand == "hevc";
    }
    return false;
}

// QML decodes images on worker threads: make sure COM is up on this one.
class ComScope
{
public:
    ComScope() : m_hr(CoInitializeEx(nullptr, COINIT_MULTITHREADED)) {}
    ~ComScope()
    {
        if (SUCCEEDED(m_hr))
            CoUninitialize();
    }

private:
    HRESULT m_hr; // RPC_E_CHANGED_MODE: already initialized (STA) — fine
};

// The stream and decoder are handed back too: the frame doesn't necessarily
// keep its decoder alive (third-party codecs), and the stream reads `data`.
struct WicFrame
{
    ComPtr<IWICStream> stream;
    ComPtr<IWICBitmapDecoder> decoder;
    ComPtr<IWICBitmapFrameDecode> frame;
};

ComPtr<IWICBitmapFrameDecode> firstFrame(IWICImagingFactory *factory, const QByteArray &data, WicFrame *keep)
{
    ComPtr<IWICStream> stream;
    if (FAILED(factory->CreateStream(&stream))
        || FAILED(stream->InitializeFromMemory(reinterpret_cast<BYTE *>(const_cast<char *>(data.constData())), DWORD(data.size()))))
        return {};
    ComPtr<IWICBitmapDecoder> decoder;
    if (FAILED(factory->CreateDecoderFromStream(stream.Get(), nullptr, WICDecodeMetadataCacheOnDemand, &decoder)))
        return {};
    ComPtr<IWICBitmapFrameDecode> frame;
    if (FAILED(decoder->GetFrame(0, &frame)))
        return {};
    keep->stream = stream;
    keep->decoder = decoder;
    keep->frame = frame;
    return frame;
}

ComPtr<IWICImagingFactory> wicFactory()
{
    ComPtr<IWICImagingFactory> f;
    CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&f));
    return f;
}
} // namespace

bool SystemImageIOHandler::canRead(QIODevice *device)
{
    return device && sniff(device->peek(16));
}

bool SystemImageIOHandler::canRead() const
{
    if (!canRead(device()))
        return false;
    setFormat(device()->peek(16).startsWith("RIFF") ? "webp" : "avif");
    return true;
}

bool SystemImageIOHandler::read(QImage *image)
{
    const QByteArray data = device()->readAll();
    if (data.isEmpty())
        return false;

    if (WebpDecode::isWebp(data) && WebpDecode::decode(data, m_scaledSize, image))
        return true;

    ComScope com;
    ComPtr<IWICImagingFactory> factory = wicFactory();
    if (!factory)
        return false;
    WicFrame keep;
    ComPtr<IWICBitmapFrameDecode> frame = firstFrame(factory.Get(), data, &keep);
    if (!frame)
        return false;

    UINT w = 0, h = 0;
    frame->GetSize(&w, &h);
    ComPtr<IWICBitmapSource> source = frame;
    // QML sourceSize → decode straight to the target size.
    if (m_scaledSize.isValid() && !m_scaledSize.isEmpty() && (UINT(m_scaledSize.width()) != w || UINT(m_scaledSize.height()) != h)) {
        ComPtr<IWICBitmapScaler> scaler;
        if (SUCCEEDED(factory->CreateBitmapScaler(&scaler))
            && SUCCEEDED(scaler->Initialize(frame.Get(), UINT(m_scaledSize.width()), UINT(m_scaledSize.height()),
                                            WICBitmapInterpolationModeFant))) {
            source = scaler;
            w = UINT(m_scaledSize.width());
            h = UINT(m_scaledSize.height());
        }
    }

    // Premultiplied BGRA = QImage::Format_ARGB32_Premultiplied on little-endian.
    ComPtr<IWICFormatConverter> conv;
    if (FAILED(factory->CreateFormatConverter(&conv))
        || FAILED(conv->Initialize(source.Get(), GUID_WICPixelFormat32bppPBGRA, WICBitmapDitherTypeNone, nullptr, 0.0,
                                   WICBitmapPaletteTypeCustom)))
        return false;

    QImage out(int(w), int(h), QImage::Format_ARGB32_Premultiplied);
    if (out.isNull())
        return false;
    if (FAILED(conv->CopyPixels(nullptr, UINT(out.bytesPerLine()), UINT(out.sizeInBytes()), out.bits())))
        return false;
    *image = out;
    return true;
}

bool SystemImageIOHandler::supportsOption(ImageOption option) const
{
    return option == ScaledSize || option == Size;
}

QVariant SystemImageIOHandler::option(ImageOption option) const
{
    if (option != Size || !device())
        return {};
    // Header-only size query (doesn't consume the device).
    const QByteArray head = device()->peek(64);
    if (WebpDecode::isWebp(head)) {
        // The size lives in the first chunk header: no need to read the file.
        const QSize s = WebpDecode::size(head);
        if (s.isValid())
            return s;
    }
    const QByteArray data = device()->peek(device()->size() > 0 ? device()->size() : 1 << 20);
    ComScope com;
    ComPtr<IWICImagingFactory> factory = wicFactory();
    if (!factory)
        return {};
    WicFrame keep;
    ComPtr<IWICBitmapFrameDecode> frame = firstFrame(factory.Get(), data, &keep);
    UINT w = 0, h = 0;
    if (!frame || FAILED(frame->GetSize(&w, &h)) || !w || !h)
        return {};
    return QSize(int(w), int(h));
}

void SystemImageIOHandler::setOption(ImageOption option, const QVariant &value)
{
    if (option == ScaledSize)
        m_scaledSize = value.toSize();
}

QImageIOPlugin::Capabilities SystemImageIOPlugin::capabilities(QIODevice *device, const QByteArray &format) const
{
    if (format == "webp" || format == "avif" || format == "heic" || format == "heif")
        return CanRead;
    if (format.isEmpty() && SystemImageIOHandler::canRead(device))
        return CanRead;
    return {};
}

QImageIOHandler *SystemImageIOPlugin::create(QIODevice *device, const QByteArray &format) const
{
    auto *h = new SystemImageIOHandler;
    h->setDevice(device);
    h->setFormat(format);
    return h;
}
