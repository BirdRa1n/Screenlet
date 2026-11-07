#include "SystemImageIO.h"

#include <QImage>
#include <QIODevice>
#include <QVariant>

#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>

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

    @autoreleasepool {
        NSData *nsData = [NSData dataWithBytes:data.constData() length:NSUInteger(data.size())];
        CGImageSourceRef source = CGImageSourceCreateWithData((__bridge CFDataRef)nsData, nullptr);
        if (!source)
            return false;
        CGImageRef cg = CGImageSourceCreateImageAtIndex(source, 0, nullptr);
        CFRelease(source);
        if (!cg)
            return false;

        QSize size(int(CGImageGetWidth(cg)), int(CGImageGetHeight(cg)));
        if (m_scaledSize.isValid() && !m_scaledSize.isEmpty())
            size = m_scaledSize; // QML sourceSize → decode straight to the target size

        QImage out(size, QImage::Format_ARGB32_Premultiplied);
        out.fill(Qt::transparent);
        CGColorSpaceRef space = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
        CGContextRef ctx = CGBitmapContextCreate(out.bits(), size_t(size.width()), size_t(size.height()), 8,
                                                 size_t(out.bytesPerLine()), space,
                                                 uint32_t(kCGImageAlphaPremultipliedFirst) | uint32_t(kCGBitmapByteOrder32Little));
        CGColorSpaceRelease(space);
        if (!ctx) {
            CGImageRelease(cg);
            return false;
        }
        CGContextSetInterpolationQuality(ctx, kCGInterpolationHigh);
        CGContextDrawImage(ctx, CGRectMake(0, 0, size.width(), size.height()), cg);
        CGContextRelease(ctx);
        CGImageRelease(cg);
        *image = out;
    }
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
    const QByteArray data = device()->peek(device()->size() > 0 ? device()->size() : 1 << 20);
    @autoreleasepool {
        NSData *nsData = [NSData dataWithBytes:data.constData() length:NSUInteger(data.size())];
        CGImageSourceRef source = CGImageSourceCreateWithData((__bridge CFDataRef)nsData, nullptr);
        if (!source)
            return {};
        NSDictionary *props = (__bridge_transfer NSDictionary *)CGImageSourceCopyPropertiesAtIndex(source, 0, nullptr);
        CFRelease(source);
        const int w = [props[(NSString *)kCGImagePropertyPixelWidth] intValue];
        const int h = [props[(NSString *)kCGImagePropertyPixelHeight] intValue];
        return w > 0 && h > 0 ? QVariant(QSize(w, h)) : QVariant();
    }
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
