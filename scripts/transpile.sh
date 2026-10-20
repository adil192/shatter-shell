#!/bin/bash
set -e

use_tsc() {
    if command -v tsc >/dev/null 2>&1; then
        tsc
    else
        npx tsc
    fi
}
use_sass() {
    if command -v sass >/dev/null 2>&1; then
        sass "$@"
    else
        echo "Warning: Using npm sass. Install dart sass for faster builds: https://sass-lang.com/install/"
        npx sass "$@"
    fi
}

# We no longer call `glib-compile-schemas`. This flag now controls whether the .gschemas.xml file is included in _build.
[ "$COMPILE_SCHEMAS" == "true" ] || [ "$COMPILE_SCHEMAS" == "false" ] || (echo "Invalid COMPILE_SCHEMAS=$COMPILE_SCHEMAS"; exit 1)

echo Compiling into target/...
use_tsc
use_sass --no-source-map \
    light.scss:target/light.css \
    dark.scss:target/dark.css \
    highcontrast.scss:target/highcontrast.css

echo Packing into _build/...
rm -rf _build && mkdir _build
cp -r metadata.json icons README.md target/* _build/
[ "$COMPILE_SCHEMAS" == "true" ] && install -D schemas/org.gnome.shell.extensions.shatter-shell.gschema.xml -t _build/schemas/
find _build -name "*.tsbuildinfo" -delete
find _build -name "*.d.ts" -delete
