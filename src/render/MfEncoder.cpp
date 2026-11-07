#include "MfEncoder.h"

#include <QtGlobal>

#if defined(Q_OS_WIN)

#include <QDebug>

#include <algorithm>
#include <cmath>
#include <vector>

#include <windows.h>
#include <initguid.h>
#include <codecapi.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <mfapi.h>
#include <mferror.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <mftransform.h>
#include <wrl/client.h>

using Microsoft::WRL::ComPtr;

namespace {
constexpr int kSampleRate = 48000;
constexpr int kChannels = 2;
constexpr LONGLONG kHns = 10'000'000; // 100 ns units per second

QString hr(HRESULT h) { return QStringLiteral("0x%1").arg(quint32(h), 8, 16, QLatin1Char('0')); }

QString friendlyName(IMFAttributes *a)
{
    if (!a)
        return {};
    WCHAR *s = nullptr;
    UINT32 len = 0;
    if (FAILED(a->GetAllocatedString(MFT_FRIENDLY_NAME_Attribute, &s, &len)))
        return {};
    const QString out = QString::fromWCharArray(s, int(len));
    CoTaskMemFree(s);
    return out;
}

// D3D11 device for the hardware encoder, on the adapter the user picked.
ComPtr<IMFDXGIDeviceManager> makeDeviceManager(int adapterIndex)
{
    ComPtr<IDXGIAdapter1> adapter;
    if (adapterIndex >= 0) {
        ComPtr<IDXGIFactory1> f;
        if (SUCCEEDED(CreateDXGIFactory1(IID_PPV_ARGS(&f))))
            f->EnumAdapters1(UINT(adapterIndex), &adapter);
    }
    const D3D_FEATURE_LEVEL levels[] = {D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0, D3D_FEATURE_LEVEL_10_1,
                                        D3D_FEATURE_LEVEL_10_0};
    ComPtr<ID3D11Device> dev;
    HRESULT h = D3D11CreateDevice(adapter.Get(), adapter ? D3D_DRIVER_TYPE_UNKNOWN : D3D_DRIVER_TYPE_HARDWARE, nullptr,
                                  D3D11_CREATE_DEVICE_VIDEO_SUPPORT | D3D11_CREATE_DEVICE_BGRA_SUPPORT, levels,
                                  UINT(std::size(levels)), D3D11_SDK_VERSION, &dev, nullptr, nullptr);
    if (FAILED(h))
        return {};
    ComPtr<ID3D10Multithread> mt;
    if (SUCCEEDED(dev.As(&mt)))
        mt->SetMultithreadProtected(TRUE);
    UINT token = 0;
    ComPtr<IMFDXGIDeviceManager> mgr;
    if (FAILED(MFCreateDXGIDeviceManager(&token, &mgr)) || FAILED(mgr->ResetDevice(dev.Get(), token)))
        return {};
    return mgr;
}
} // namespace

struct MfEncoder::D {
    bool started = false;
    ComPtr<IMFSinkWriter> writer;
    DWORD video = 0;
    DWORD audio = 0;
    bool hasAudio = false;
    int fps = 30;
    QSize size;
    std::vector<qint16> pcm16;

    ~D()
    {
        writer.Reset();
        if (started)
            MFShutdown();
    }
};

MfEncoder::MfEncoder() = default;
MfEncoder::~MfEncoder() = default;

bool MfEncoder::open(const QString &path, const Options &opt, QString *error)
{
    d = std::make_unique<D>();
    if (FAILED(MFStartup(MF_VERSION, MFSTARTUP_LITE))) {
        *error = QStringLiteral("Media Foundation indisponível.");
        return false;
    }
    d->started = true;
    d->fps = opt.fps;
    d->size = opt.size;
    d->hasAudio = opt.audio;

    ComPtr<IMFAttributes> attr;
    MFCreateAttributes(&attr, 4);
    attr->SetGUID(MF_TRANSCODE_CONTAINERTYPE, MFTranscodeContainerType_MPEG4);
    attr->SetUINT32(MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, opt.hardware ? TRUE : FALSE);
    if (opt.hardware)
        if (ComPtr<IMFDXGIDeviceManager> mgr = makeDeviceManager(opt.adapterIndex))
            attr->SetUnknown(MF_SINK_WRITER_D3D_MANAGER, mgr.Get());

    HRESULT h = MFCreateSinkWriterFromURL(reinterpret_cast<LPCWSTR>(path.utf16()), nullptr, attr.Get(), &d->writer);
    if (FAILED(h)) {
        *error = QStringLiteral("Não foi possível criar o arquivo de vídeo (%1).").arg(hr(h));
        return false;
    }

    const UINT32 w = UINT32(opt.size.width()), hgt = UINT32(opt.size.height());

    // ── Video ──
    ComPtr<IMFMediaType> vout;
    MFCreateMediaType(&vout);
    vout->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
    vout->SetGUID(MF_MT_SUBTYPE, opt.h265 ? MFVideoFormat_HEVC : MFVideoFormat_H264);
    vout->SetUINT32(MF_MT_AVG_BITRATE, UINT32(opt.bitrate));
    vout->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
    vout->SetUINT32(MF_MT_MPEG2_PROFILE, opt.h265 ? UINT32(eAVEncH265VProfile_Main_420_8) : UINT32(eAVEncH264VProfile_High));
    MFSetAttributeSize(vout.Get(), MF_MT_FRAME_SIZE, w, hgt);
    MFSetAttributeRatio(vout.Get(), MF_MT_FRAME_RATE, UINT32(opt.fps), 1);
    MFSetAttributeRatio(vout.Get(), MF_MT_PIXEL_ASPECT_RATIO, 1, 1);
    h = d->writer->AddStream(vout.Get(), &d->video);
    if (FAILED(h)) {
        *error = QStringLiteral("Este computador não tem codificador %1 (%2).")
                     .arg(opt.h265 ? QStringLiteral("H.265") : QStringLiteral("H.264"), hr(h));
        return false;
    }

    // Top-down BGRX (QImage::Format_RGB32); the sink writer adds the color
    // converter (on the GPU when it has the D3D manager).
    ComPtr<IMFMediaType> vin;
    MFCreateMediaType(&vin);
    vin->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
    vin->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_RGB32);
    vin->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
    vin->SetUINT32(MF_MT_DEFAULT_STRIDE, w * 4);
    MFSetAttributeSize(vin.Get(), MF_MT_FRAME_SIZE, w, hgt);
    MFSetAttributeRatio(vin.Get(), MF_MT_FRAME_RATE, UINT32(opt.fps), 1);
    MFSetAttributeRatio(vin.Get(), MF_MT_PIXEL_ASPECT_RATIO, 1, 1);
    h = d->writer->SetInputMediaType(d->video, vin.Get(), nullptr);
    if (FAILED(h)) {
        *error = QStringLiteral("O codificador recusou o formato de entrada (%1).").arg(hr(h));
        return false;
    }

    // Keyframe every 2 s: players joining an IPTV loop start quickly.
    ComPtr<ICodecAPI> codec;
    // MinGW has no __uuidof(ICodecAPI): spell the IID out.
    static const GUID kIIDCodecAPI = {0x901db4c7, 0x31ce, 0x41a2, {0x85, 0xdc, 0x8f, 0xa0, 0xbf, 0x41, 0xb8, 0xda}};
    if (SUCCEEDED(d->writer->GetServiceForStream(d->video, GUID_NULL, kIIDCodecAPI, reinterpret_cast<void **>(codec.GetAddressOf())))) {
        VARIANT v;
        VariantInit(&v);
        v.vt = VT_UI4;
        v.ulVal = ULONG(opt.fps * 2);
        codec->SetValue(&CODECAPI_AVEncMPVGOPSize, &v);
    }

    // ── Audio ──
    if (opt.audio) {
        ComPtr<IMFMediaType> aout;
        MFCreateMediaType(&aout);
        aout->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Audio);
        aout->SetGUID(MF_MT_SUBTYPE, MFAudioFormat_AAC);
        aout->SetUINT32(MF_MT_AUDIO_BITS_PER_SAMPLE, 16);
        aout->SetUINT32(MF_MT_AUDIO_SAMPLES_PER_SECOND, kSampleRate);
        aout->SetUINT32(MF_MT_AUDIO_NUM_CHANNELS, kChannels);
        aout->SetUINT32(MF_MT_AUDIO_AVG_BYTES_PER_SECOND, 24000); // 192 kbit/s
        aout->SetUINT32(MF_MT_AAC_PAYLOAD_TYPE, 0);
        h = d->writer->AddStream(aout.Get(), &d->audio);
        ComPtr<IMFMediaType> ain;
        MFCreateMediaType(&ain);
        ain->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Audio);
        ain->SetGUID(MF_MT_SUBTYPE, MFAudioFormat_PCM);
        ain->SetUINT32(MF_MT_AUDIO_BITS_PER_SAMPLE, 16);
        ain->SetUINT32(MF_MT_AUDIO_SAMPLES_PER_SECOND, kSampleRate);
        ain->SetUINT32(MF_MT_AUDIO_NUM_CHANNELS, kChannels);
        ain->SetUINT32(MF_MT_AUDIO_BLOCK_ALIGNMENT, kChannels * 2);
        ain->SetUINT32(MF_MT_AUDIO_AVG_BYTES_PER_SECOND, kSampleRate * kChannels * 2);
        ain->SetUINT32(MF_MT_ALL_SAMPLES_INDEPENDENT, TRUE);
        if (SUCCEEDED(h))
            h = d->writer->SetInputMediaType(d->audio, ain.Get(), nullptr);
        if (FAILED(h)) {
            *error = QStringLiteral("Codificador AAC indisponível (%1).").arg(hr(h));
            return false;
        }
    }

    h = d->writer->BeginWriting();
    if (FAILED(h)) {
        *error = QStringLiteral("Não foi possível iniciar o codificador (%1).").arg(hr(h));
        return false;
    }

    // Which encoder MFT the sink writer really loaded (hardware or not).
    ComPtr<IMFSinkWriterEx> ex;
    if (SUCCEEDED(d->writer.As(&ex))) {
        GUID cat;
        ComPtr<IMFTransform> t;
        for (DWORD i = 0; SUCCEEDED(ex->GetTransformForStream(d->video, i, &cat, &t)); ++i, t.Reset()) {
            if (cat != MFT_CATEGORY_VIDEO_ENCODER)
                continue;
            ComPtr<IMFAttributes> ta;
            if (SUCCEEDED(t->GetAttributes(&ta))) {
                m_encoderName = friendlyName(ta.Get());
                UINT32 len = 0;
                m_hardware = SUCCEEDED(ta->GetStringLength(MFT_ENUM_HARDWARE_URL_Attribute, &len));
            }
            break;
        }
    }
    if (m_encoderName.isEmpty())
        m_encoderName = QStringLiteral("Media Foundation");
    qInfo().noquote() << "MfEncoder:" << m_encoderName << (m_hardware ? "(hardware)" : "(software)")
                      << opt.size << opt.fps << "fps" << opt.bitrate / 1000 << "kbit/s";
    return true;
}

bool MfEncoder::writeVideo(const QImage &frame, qint64 index, QString *error)
{
    const QImage img = frame.format() == QImage::Format_RGB32 ? frame : frame.convertToFormat(QImage::Format_RGB32);
    const DWORD rowBytes = DWORD(img.width()) * 4;
    const DWORD bytes = rowBytes * DWORD(img.height());
    ComPtr<IMFMediaBuffer> buf;
    HRESULT h = MFCreateMemoryBuffer(bytes, &buf);
    BYTE *dst = nullptr;
    if (SUCCEEDED(h))
        h = buf->Lock(&dst, nullptr, nullptr);
    if (FAILED(h)) {
        *error = QStringLiteral("Sem memória para o quadro (%1).").arg(hr(h));
        return false;
    }
    MFCopyImage(dst, LONG(rowBytes), img.constBits(), LONG(img.bytesPerLine()), rowBytes, DWORD(img.height()));
    buf->Unlock();
    buf->SetCurrentLength(bytes);

    ComPtr<IMFSample> s;
    MFCreateSample(&s);
    s->AddBuffer(buf.Get());
    const LONGLONG t0 = index * kHns / d->fps;
    const LONGLONG t1 = (index + 1) * kHns / d->fps;
    s->SetSampleTime(t0);
    s->SetSampleDuration(t1 - t0);
    h = d->writer->WriteSample(d->video, s.Get());
    if (FAILED(h)) {
        *error = QStringLiteral("O codificador de vídeo falhou (%1).").arg(hr(h));
        return false;
    }
    return true;
}

bool MfEncoder::writeAudio(const float *pcm, qint64 frames, qint64 startFrame, QString *error)
{
    if (!d->hasAudio || frames <= 0)
        return true;
    const qint64 n = frames * kChannels;
    d->pcm16.resize(size_t(n));
    for (qint64 i = 0; i < n; ++i)
        d->pcm16[size_t(i)] = qint16(std::lround(std::clamp(pcm[i], -1.f, 1.f) * 32767.f));
    const DWORD bytes = DWORD(n * 2);
    ComPtr<IMFMediaBuffer> buf;
    HRESULT h = MFCreateMemoryBuffer(bytes, &buf);
    BYTE *dst = nullptr;
    if (SUCCEEDED(h))
        h = buf->Lock(&dst, nullptr, nullptr);
    if (FAILED(h)) {
        *error = QStringLiteral("Sem memória para o áudio (%1).").arg(hr(h));
        return false;
    }
    memcpy(dst, d->pcm16.data(), bytes);
    buf->Unlock();
    buf->SetCurrentLength(bytes);
    ComPtr<IMFSample> s;
    MFCreateSample(&s);
    s->AddBuffer(buf.Get());
    s->SetSampleTime(startFrame * kHns / kSampleRate);
    s->SetSampleDuration(frames * kHns / kSampleRate);
    h = d->writer->WriteSample(d->audio, s.Get());
    if (FAILED(h)) {
        *error = QStringLiteral("O codificador de áudio falhou (%1).").arg(hr(h));
        return false;
    }
    return true;
}

bool MfEncoder::finish(QString *error)
{
    const HRESULT h = d->writer->Finalize();
    d.reset();
    if (FAILED(h)) {
        *error = QStringLiteral("Falha ao finalizar o MP4 (%1).").arg(hr(h));
        return false;
    }
    return true;
}

void MfEncoder::abort() { d.reset(); }

QStringList MfEncoder::hardwareEncoders(bool h265)
{
    QStringList out;
    if (FAILED(MFStartup(MF_VERSION, MFSTARTUP_LITE)))
        return out;
    MFT_REGISTER_TYPE_INFO type{MFMediaType_Video, h265 ? MFVideoFormat_HEVC : MFVideoFormat_H264};
    IMFActivate **acts = nullptr;
    UINT32 count = 0;
    if (SUCCEEDED(MFTEnumEx(MFT_CATEGORY_VIDEO_ENCODER, MFT_ENUM_FLAG_HARDWARE | MFT_ENUM_FLAG_SORTANDFILTER, nullptr,
                            &type, &acts, &count))) {
        for (UINT32 i = 0; i < count; ++i) {
            const QString n = friendlyName(acts[i]);
            if (!n.isEmpty() && !out.contains(n))
                out << n;
            acts[i]->Release();
        }
        CoTaskMemFree(acts);
    }
    MFShutdown();
    return out;
}

#else // ── other platforms: never used (FFmpeg/VideoToolbox path) ───────────────

struct MfEncoder::D {};
MfEncoder::MfEncoder() = default;
MfEncoder::~MfEncoder() = default;
bool MfEncoder::open(const QString &, const Options &, QString *error)
{
    *error = QStringLiteral("Media Foundation só existe no Windows.");
    return false;
}
bool MfEncoder::writeVideo(const QImage &, qint64, QString *) { return false; }
bool MfEncoder::writeAudio(const float *, qint64, qint64, QString *) { return false; }
bool MfEncoder::finish(QString *) { return false; }
void MfEncoder::abort() {}
QStringList MfEncoder::hardwareEncoders(bool) { return {}; }

#endif
