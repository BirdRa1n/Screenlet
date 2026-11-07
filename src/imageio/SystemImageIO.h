#pragma once

#include <QImageIOHandler>
#include <QImageIOPlugin>
#include <QSize>

// Image formats the bundled Qt kit can't read (no Qt Image Formats add-on),
// decoded with the operating system's own codecs:
//   macOS    ImageIO — WebP, AVIF, HEIC/HEIF
//   Windows  WIC — WebP (built in on 10/11), AVIF/HEIC with the Store extensions
// Compiled into the app as a static plugin, so QImage, QML Image and the
// exporter all read these files transparently.
class SystemImageIOHandler : public QImageIOHandler
{
public:
    bool canRead() const override;
    bool read(QImage *image) override;
    bool supportsOption(ImageOption option) const override;
    QVariant option(ImageOption option) const override;
    void setOption(ImageOption option, const QVariant &value) override;

    static bool canRead(QIODevice *device);

private:
    QSize m_scaledSize;
};

class SystemImageIOPlugin : public QImageIOPlugin
{
    Q_OBJECT
    Q_PLUGIN_METADATA(IID QImageIOHandlerFactoryInterface_iid FILE "systemimageio.json")
public:
    Capabilities capabilities(QIODevice *device, const QByteArray &format) const override;
    QImageIOHandler *create(QIODevice *device, const QByteArray &format) const override;
};
