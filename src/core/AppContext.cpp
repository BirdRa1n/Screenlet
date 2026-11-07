#include "AppContext.h"

#include "net/Iptv.h"
#include "net/Kodi.h"
#include "net/Players.h"
#include "net/StockEasy.h"
#include "render/Renderer.h"
#include "services/Backup.h"
#include "services/Channels.h"
#include "services/Exports.h"
#include "services/Library.h"
#include "services/Media.h"
#include "services/Projects.h"
#include "services/Settings.h"
#include "services/Storage.h"
#include "services/StoreProfiles.h"
#include "services/SystemInfo.h"
#include "services/Templates.h"
#include "services/Updater.h"

AppContext::AppContext(QObject *parent)
    : QObject(parent)
{
    // Order matters only where constructors read another service.
    new Settings(this);
    new Storage(this);
    new SystemInfo(this);
    new Media(this);
    new Templates(this);
    new Library(this);
    new Exports(this);
    new StoreProfiles(this);
    new Kodi(this);
    new Channels(this);
    new Players(this);
    new StockEasy(this);
    new Iptv(this);
    new Renderer(this);
    new Projects(this);
    new Backup(this);
    new Updater(this);
}

AppContext::~AppContext() = default;

void AppContext::startBackground(bool startedHidden)
{
    Q_UNUSED(startedHidden)
    // Unattended kiosk boot: only when BOTH settings are on (same rule as
    // the Electron build — a manual launch shouldn't silently open a port).
    // Paired Screenlet Players are the exception: they sync and download
    // through this server, so once one is paired the server is part of the
    // setup the user asked for.
    if ((Settings::instance()->launchAtLogin() && Settings::instance()->autoStartIptv()) || Players::instance()->hasPaired())
        Iptv::instance()->start();
    Updater::instance()->check(false);
}
