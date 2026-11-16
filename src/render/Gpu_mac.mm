#include <QString>

#import <Metal/Metal.h>

// Metal device the UI renders with (Qt uses the system default one): Apple
// Silicon GPUs and discrete Radeons play UI videos without strain; the Intel
// integrated GPUs of older Macs (unified memory, or flagged low-power on
// dual-GPU MacBook Pros) don't.
bool screenletMacDedicatedGpu(QString *name)
{
    @autoreleasepool {
        id<MTLDevice> dev = MTLCreateSystemDefaultDevice();
        if (!dev)
            return false;
        if (name)
            *name = QString::fromNSString(dev.name);
        if ([dev supportsFamily:MTLGPUFamilyApple7]) // M1 and later
            return true;
        return !dev.hasUnifiedMemory && !dev.isLowPower;
    }
}
