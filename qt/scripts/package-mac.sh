#!/bin/sh
# Builds a universal (Apple Silicon + Intel) Release of Screenlet, bundles Qt
# with macdeployqt, signs it and wraps it in a drag-to-Applications .dmg.
#
#   scripts/package-mac.sh
#
# Environment:
#   QT_DIR         Qt kit (default: ~/Qt/6.12.0/macos)
#   ARCHS          "arm64;x86_64" (default) or a single arch
#   SIGN_IDENTITY  codesign identity. Default: auto-detect a "Developer ID
#                  Application" or "Apple Development" certificate, falling
#                  back to "-" (ad-hoc). A real certificate keeps macOS privacy
#                  grants (Documents folder) and Keychain access across
#                  updates; ad-hoc makes macOS ask again for every new build.
#                  For distribution use "Developer ID Application", then notarize:
#                    xcrun notarytool submit build/dist/*.dmg --keychain-profile <perfil> --wait
#                    xcrun stapler staple build/dist/*.dmg
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
QT_DIR=${QT_DIR:-$HOME/Qt/6.12.0/macos}
ARCHS=${ARCHS:-"arm64;x86_64"}
if [ -z "${SIGN_IDENTITY:-}" ]; then
    IDS=$(security find-identity -v -p codesigning 2>/dev/null || true)
    SIGN_IDENTITY=$(printf '%s\n' "$IDS" | sed -n 's/.*) \([0-9A-F]\{40\}\) "Developer ID Application.*/\1/p' | head -1)
    [ -n "$SIGN_IDENTITY" ] || SIGN_IDENTITY=$(printf '%s\n' "$IDS" | sed -n 's/.*) \([0-9A-F]\{40\}\) "Apple Development.*/\1/p' | head -1)
    [ -n "$SIGN_IDENTITY" ] || SIGN_IDENTITY=-
fi
# Only Developer ID builds are notarized, and those need a secure timestamp.
if security find-identity -v -p codesigning 2>/dev/null | grep "$SIGN_IDENTITY" | grep -q "Developer ID"; then
    TS=--timestamp
else
    TS=--timestamp=none
fi
BUILD="$ROOT/build/release-universal"
DIST="$ROOT/build/dist"

export PATH="$HOME/Qt/Tools/CMake/CMake.app/Contents/bin:$HOME/Qt/Tools/Ninja:$QT_DIR/bin:$PATH"

VERSION=$(sed -n 's/^project(Screenlet VERSION \([0-9.]*\).*/\1/p' "$ROOT/CMakeLists.txt")
case "$ARCHS" in *";"*) ARCH_TAG=universal ;; *) ARCH_TAG=$ARCHS ;; esac
DMG="$DIST/Screenlet-$VERSION-$ARCH_TAG.dmg"

echo "==> Configurando ($ARCHS)"
cmake -S "$ROOT" -B "$BUILD" -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_PREFIX_PATH="$QT_DIR" \
    -DCMAKE_OSX_ARCHITECTURES="$ARCHS" \
    -DQT_NO_PRIVATE_MODULE_WARNING=ON >/dev/null

echo "==> Compilando"
cmake --build "$BUILD"

echo "==> Montando o bundle"
rm -rf "$DIST"
mkdir -p "$DIST"
cp -R "$BUILD/Screenlet.app" "$DIST/"
APP="$DIST/Screenlet.app"

# Bundles frameworks + QML imports + plugins (incl. the FFmpeg multimedia
# backend and its libav* dylibs) and rewrites install names.
macdeployqt "$APP" -qmldir="$ROOT/qml" -always-overwrite -verbose=1

# Plugins the app never loads: keep the bundle lean. (macdeployqt's errors
# about libpq/libiodbc/libmimerapi come from these SQL drivers — harmless.)
rm -rf "$APP/Contents/PlugIns/sqldrivers" "$APP/Contents/PlugIns/virtualkeyboard" 2>/dev/null || true
# The UI only uses the Basic Controls style; drop the other styles.
for style in FluentWinUI3 Imagine Material Universal IOS; do
    rm -rf "$APP/Contents/Frameworks/QtQuickControls2${style}.framework" \
           "$APP/Contents/Frameworks/QtQuickControls2${style}StyleImpl.framework" \
           "$APP/Contents/Resources/qml/QtQuick/Controls/${style}" 2>/dev/null || true
done

# The build tree's qt.conf points QmlImports at this machine's build folder;
# replace it with bundle-relative paths so the app is self-contained.
cat > "$APP/Contents/Resources/qt.conf" <<'QTCONF'
[Paths]
Plugins = PlugIns
Imports = Resources/qml
QmlImports = Resources/qml
QTCONF

echo "==> Assinando ($SIGN_IDENTITY)"
if [ "$SIGN_IDENTITY" = "-" ]; then
    codesign --force --deep --sign - "$APP"
else
    codesign --force --deep --options runtime $TS \
        --entitlements "$ROOT/resources/entitlements.plist" --sign "$SIGN_IDENTITY" "$APP"
fi
codesign --verify --deep --strict "$APP"

echo "==> Gerando o .dmg"
STAGE="$DIST/dmg-stage"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Aplicativos"
hdiutil create -volname "Screenlet $VERSION" -srcfolder "$STAGE" -ov -format UDZO -fs HFS+ "$DMG" >/dev/null
rm -rf "$STAGE"
if [ "$SIGN_IDENTITY" != "-" ]; then
    codesign --force --sign "$SIGN_IDENTITY" $TS "$DMG"
fi

echo "==> Pronto"
echo "    $(du -sh "$APP" | cut -f1)  $APP"
echo "    $(du -sh "$DMG" | cut -f1)  $DMG"
