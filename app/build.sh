#!/bin/sh
# Build 坨坨.app (universal: arm64 + x86_64, macOS 11+), ad-hoc signed.  usage: ./build.sh
set -e
cd "$(dirname "$0")"
APP="build/坨坨.app"
SDK="$(xcrun --show-sdk-path)"
rm -rf build && mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web"
for arch in arm64 x86_64; do
  swiftc -O -swift-version 5 -target "$arch-apple-macos11.0" -sdk "$SDK" Sources/main.swift -o "build/Tuotuo-$arch" \
    -framework Cocoa -framework WebKit -framework IOKit -framework ServiceManagement
done
lipo -create build/Tuotuo-arm64 build/Tuotuo-x86_64 -output "$APP/Contents/MacOS/Tuotuo"
rm build/Tuotuo-arm64 build/Tuotuo-x86_64
cp Info.plist "$APP/Contents/"
for f in index.html host.js pet.js sound.js lines.js zcool.ttf OFL.txt; do cp "../web/$f" "$APP/Contents/Resources/web/"; done
[ -f icon/AppIcon.icns ] && cp icon/AppIcon.icns "$APP/Contents/Resources/"
codesign --force --deep --sign - "$APP"
echo "built $APP ($(du -sh "$APP" | cut -f1))"
