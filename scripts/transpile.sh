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

echo Compiling into target/...
glib-compile-schemas schemas &
use_tsc
use_sass --no-source-map \
    light.scss:target/light.css \
    dark.scss:target/dark.css \
    highcontrast.scss:target/highcontrast.css
wait
ls target
echo

echo Packing into _build/...
rm -rf _build && mkdir _build
cp -r metadata.json icons README.md schemas target/* _build/
find _build -name "*.tsbuildinfo" -delete
find _build -name "*.d.ts" -delete
ls _build
echo
