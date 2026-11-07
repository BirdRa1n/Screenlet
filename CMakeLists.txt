cmake_minimum_required(VERSION 3.21)

# Before project(): macOS minimum — the Qt 6.12 binaries are built for 14.4+.
if(NOT CMAKE_OSX_DEPLOYMENT_TARGET)  # also repairs caches created empty
    set(CMAKE_OSX_DEPLOYMENT_TARGET "14.4" CACHE STRING "Minimum macOS version" FORCE)
endif()

project(Screenlet VERSION 2.0.1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(APPLE)
    enable_language(OBJCXX)
endif()

# QZipWriter (backup) and QRhi (renderer) come from Qt's private modules on
# purpose; don't warn about it on every configure.
set(QT_NO_PRIVATE_MODULE_WARNING ON)

find_package(Qt6 6.8 REQUIRED COMPONENTS
    Core Gui Widgets Qml Quick QuickControls2 Multimedia Network Concurrent CorePrivate GuiPrivate)

qt_standard_project_setup(REQUIRES 6.8)
qt_policy(SET QTP0004 NEW)

# ── Sources ───────────────────────────────────────────────────────────────────
set(CPP_SOURCES
    src/main.cpp
    src/core/AppContext.h        src/core/AppContext.cpp
    src/core/Paths.h             src/core/Paths.cpp
    src/core/JsonIo.h            src/core/JsonIo.cpp
    src/core/SecretStore.h       src/core/SecretStore.cpp
    src/core/SecureZip.h         src/core/SecureZip.cpp
    src/core/Async.h
    src/services/Storage.h       src/services/Storage.cpp
    src/services/Settings.h      src/services/Settings.cpp
    src/services/Projects.h      src/services/Projects.cpp
    src/services/Templates.h     src/services/Templates.cpp
    src/services/Library.h       src/services/Library.cpp
    src/services/Media.h         src/services/Media.cpp
    src/services/Exports.h       src/services/Exports.cpp
    src/services/Channels.h      src/services/Channels.cpp
    src/services/StoreProfiles.h src/services/StoreProfiles.cpp
    src/services/Backup.h        src/services/Backup.cpp
    src/services/SystemInfo.h    src/services/SystemInfo.cpp
    src/services/Updater.h       src/services/Updater.cpp
    src/net/HttpServer.h         src/net/HttpServer.cpp
    src/net/Iptv.h               src/net/Iptv.cpp
    src/net/Kodi.h               src/net/Kodi.cpp
    src/net/Players.h            src/net/Players.cpp
    src/net/StockEasy.h          src/net/StockEasy.cpp
    src/render/Renderer.h        src/render/Renderer.cpp
    src/render/AudioMix.h        src/render/AudioMix.cpp
    src/render/Gpu.h             src/render/Gpu.cpp
    src/render/MfEncoder.h       src/render/MfEncoder.cpp
)
if(APPLE)
    list(APPEND CPP_SOURCES src/core/SecretStore_mac.mm)
    set_source_files_properties(src/core/SecretStore_mac.mm PROPERTIES COMPILE_OPTIONS "-fobjc-arc")
endif()

file(GLOB_RECURSE QML_FILES CONFIGURE_DEPENDS RELATIVE ${CMAKE_CURRENT_SOURCE_DIR} qml/*.qml qml/*.js)
file(GLOB_RECURSE RES_FILES CONFIGURE_DEPENDS RELATIVE ${CMAKE_CURRENT_SOURCE_DIR}
    resources/templates/*.json resources/assets/*.png resources/icon.png resources/tray.png fonts/*.ttf fonts/*.otf)

# Singletons declared in QML must be flagged before the module is created.
foreach(f ${QML_FILES})
    if(f MATCHES "qml/singletons/.*\\.qml$")
        set_source_files_properties(${f} PROPERTIES QT_QML_SINGLETON_TYPE TRUE)
    endif()
endforeach()

qt_add_executable(Screenlet MACOSX_BUNDLE WIN32 ${CPP_SOURCES})

qt_add_qml_module(Screenlet
    URI Screenlet
    VERSION 1.0
    QML_FILES ${QML_FILES}
    RESOURCES ${RES_FILES}
)

target_include_directories(Screenlet PRIVATE src src/core src/services src/net src/render)

# WebP / AVIF / HEIC via the OS codecs (the Qt kit has no Image Formats
# add-on). Static plugin, imported in main.cpp with Q_IMPORT_PLUGIN.
if(APPLE)
    qt_add_plugin(screenlet_imageio STATIC
        CLASS_NAME SystemImageIOPlugin
        PLUGIN_TYPE imageformats
        src/imageio/SystemImageIO.h
        src/imageio/SystemImageIO_mac.mm)
    set_source_files_properties(src/imageio/SystemImageIO_mac.mm PROPERTIES COMPILE_OPTIONS "-fobjc-arc")
    target_link_libraries(screenlet_imageio PRIVATE Qt6::Gui
        "-framework ImageIO" "-framework CoreGraphics" "-framework Foundation")
    target_link_libraries(Screenlet PRIVATE screenlet_imageio)
    target_compile_definitions(Screenlet PRIVATE SCREENLET_SYSTEM_IMAGEIO)
endif()

target_link_libraries(Screenlet PRIVATE
    Qt6::Core Qt6::Gui Qt6::Widgets Qt6::Qml Qt6::Quick Qt6::QuickControls2
    Qt6::Multimedia Qt6::Network Qt6::Concurrent Qt6::CorePrivate Qt6::GuiPrivate)

if(APPLE)
    target_link_libraries(Screenlet PRIVATE "-framework Security")
    # App icon: resources/AppIcon.icon is an Icon Composer document (layered,
    # Liquid Glass on macOS 26+). actool (Xcode 26+) compiles it into
    # Assets.car (CFBundleIconName) plus AppIcon.icns for older macOS.
    # Without Xcode, fall back to the pre-rendered resources/icon.icns.
    find_program(SCREENLET_ACTOOL actool
        HINTS /Applications/Xcode.app/Contents/Developer/usr/bin
        DOC "Xcode actool, compiles resources/AppIcon.icon")
    set(_icon_doc ${CMAKE_CURRENT_SOURCE_DIR}/resources/AppIcon.icon)
    if(SCREENLET_ACTOOL)
        get_filename_component(_devdir "${SCREENLET_ACTOOL}" DIRECTORY)   # …/usr/bin
        get_filename_component(_devdir "${_devdir}/../.." ABSOLUTE)       # …/Developer
        set(_icon_out ${CMAKE_CURRENT_BINARY_DIR}/appicon)
        file(GLOB _icon_deps CONFIGURE_DEPENDS ${_icon_doc}/icon.json ${_icon_doc}/Assets/*)
        add_custom_command(
            OUTPUT ${_icon_out}/Assets.car ${_icon_out}/AppIcon.icns
            COMMAND ${CMAKE_COMMAND} -E make_directory ${_icon_out}
            COMMAND ${CMAKE_COMMAND} -E env DEVELOPER_DIR=${_devdir}
                    ${SCREENLET_ACTOOL} ${_icon_doc} --compile ${_icon_out}
                    --app-icon AppIcon --platform macosx
                    --minimum-deployment-target ${CMAKE_OSX_DEPLOYMENT_TARGET}
                    --output-partial-info-plist ${_icon_out}/partial.plist
                    --output-format human-readable-text
            DEPENDS ${_icon_deps}
            COMMENT "Compilando o ícone (Icon Composer → Assets.car)"
            VERBATIM)
        set(APP_ICON ${_icon_out}/Assets.car ${_icon_out}/AppIcon.icns)
        set(MACOSX_BUNDLE_ICON_FILE AppIcon)
        set(MACOSX_BUNDLE_ICON_NAME AppIcon)
    else()
        message(WARNING "Screenlet: actool (Xcode 26+) não encontrado — usando resources/icon.icns "
                        "sem o efeito Liquid Glass do macOS 26.")
        set(APP_ICON ${CMAKE_CURRENT_SOURCE_DIR}/resources/icon.icns)
        set(MACOSX_BUNDLE_ICON_FILE icon.icns)
        set(MACOSX_BUNDLE_ICON_NAME "")
    endif()
    set_source_files_properties(${APP_ICON} PROPERTIES MACOSX_PACKAGE_LOCATION "Resources")
    target_sources(Screenlet PRIVATE ${APP_ICON})
elseif(WIN32)
    # Ícone e versão do .exe (Explorer, atalhos, barra de tarefas).
    set(SCREENLET_ICO ${CMAKE_CURRENT_SOURCE_DIR}/resources/icon.ico)
    configure_file(resources/Screenlet.rc.in ${CMAKE_CURRENT_BINARY_DIR}/Screenlet.rc @ONLY)
    target_sources(Screenlet PRIVATE ${CMAKE_CURRENT_BINARY_DIR}/Screenlet.rc)
    # Media Foundation (GPU encoder) + DXGI/D3D11 (GPU selection).
    target_link_libraries(Screenlet PRIVATE crypt32 bcrypt advapi32 ole32 oleaut32
        mfplat mfreadwrite mfuuid d3d11 dxgi)
endif()

set_target_properties(Screenlet PROPERTIES
    OUTPUT_NAME "Screenlet"
    MACOSX_BUNDLE_GUI_IDENTIFIER com.screenlet.app
    MACOSX_BUNDLE_BUNDLE_NAME Screenlet
    MACOSX_BUNDLE_BUNDLE_VERSION ${PROJECT_VERSION}
    MACOSX_BUNDLE_SHORT_VERSION_STRING ${PROJECT_VERSION}
    MACOSX_BUNDLE_INFO_PLIST ${CMAKE_CURRENT_SOURCE_DIR}/resources/Info.plist.in
)

# ── macOS code signing for every local build ──────────────────────────────────
# macOS privacy grants (Documents folder, local network) and Keychain access
# are tied to the app's code signature. The linker's ad-hoc signature changes
# on every build (and differs per copy), so macOS asked again on each launch.
# Signing with a real certificate gives a stable designated requirement
# (bundle id + certificate), so the grant survives rebuilds.
#   -DSCREENLET_SIGN_IDENTITY=<sha1|name>   explicit identity, "-" = ad-hoc
if(APPLE)
    set(SCREENLET_SIGN_IDENTITY "" CACHE STRING "codesign identity (empty = auto-detect, '-' = ad-hoc)")
    set(_sign_id "${SCREENLET_SIGN_IDENTITY}")
    if(_sign_id STREQUAL "")
        execute_process(COMMAND security find-identity -v -p codesigning
                        OUTPUT_VARIABLE _ids ERROR_QUIET)
        string(REGEX MATCH "([0-9A-F]+) \"Developer ID Application" _m "${_ids}")
        if(NOT _m)
            string(REGEX MATCH "([0-9A-F]+) \"Apple Development" _m "${_ids}")
        endif()
        set(_sign_id "${CMAKE_MATCH_1}")
    endif()
    if(_sign_id AND NOT _sign_id STREQUAL "-")
        message(STATUS "Screenlet: assinando builds com a identidade ${_sign_id}")
        add_custom_command(TARGET Screenlet POST_BUILD
            COMMAND codesign --force --timestamp=none --sign "${_sign_id}" "$<TARGET_BUNDLE_DIR:Screenlet>"
            COMMENT "Assinando Screenlet.app"
            VERBATIM)
    else()
        message(WARNING "Screenlet: nenhum certificado de assinatura encontrado — o macOS "
                        "vai pedir acesso às pastas de novo a cada build.")
    endif()
endif()

target_compile_definitions(Screenlet PRIVATE
    SCREENLET_VERSION="${PROJECT_VERSION}"
    $<$<CONFIG:Debug>:QT_QML_DEBUG>)

if(MSVC)
    target_compile_options(Screenlet PRIVATE /W4)
else()
    target_compile_options(Screenlet PRIVATE -Wall -Wextra)
endif()

# ── Tests ─────────────────────────────────────────────────────────────────────
enable_testing()
qt_add_executable(securezip_test tests/securezip_test.cpp src/core/SecureZip.h src/core/SecureZip.cpp)
set_target_properties(securezip_test PROPERTIES MACOSX_BUNDLE FALSE WIN32_EXECUTABLE FALSE)
target_include_directories(securezip_test PRIVATE src)
target_link_libraries(securezip_test PRIVATE Qt6::Core Qt6::Network)
if(WIN32)
    target_link_libraries(securezip_test PRIVATE bcrypt)
endif()
add_test(NAME securezip COMMAND securezip_test ${CMAKE_CURRENT_BINARY_DIR}/securezip-work)

include(GNUInstallDirs)
install(TARGETS Screenlet
    BUNDLE DESTINATION .
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})

qt_generate_deploy_qml_app_script(TARGET Screenlet OUTPUT_SCRIPT deploy_script)
install(SCRIPT ${deploy_script})
