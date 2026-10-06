#!/bin/bash

set -ex

if ! command -v gnome-extensions >/dev/null; then
    # shellcheck disable=SC2016
    echo 'You must install gnome-extensions to configure or enable via this script (`gnome-shell` on Debian systems, `gnome-extensions` on openSUSE systems.)'
    exit 1
fi

# Make sure user extensions are enabled
dconf write /org/gnome/shell/disable-user-extensions false

# Workspaces spanning displays works better with Shatter Shell
dconf write /org/gnome/mutter/workspaces-only-on-primary false

# https://extensions.gnome.org/extension/18/native-window-placement/
if ! gnome-extensions list | grep native-window-placement@gnome-shell-extensions.gcampax.github.com; then
    echo "Installing an overview extension that works better for tiling..."
    gdbus call --session --dest org.gnome.Shell.Extensions --object-path /org/gnome/Shell/Extensions \
        --method org.gnome.Shell.Extensions.InstallRemoteExtension \
        native-window-placement@gnome-shell-extensions.gcampax.github.com 2>/dev/null || true
fi
gnome-extensions enable native-window-placement@gnome-shell-extensions.gcampax.github.com || true

# Disable Pop Shell if installed
if gnome-extensions list | grep pop-shell@system76.com; then
    echo "Disabling Pop Shell since it would conflict with Shatter Shell."
    gnome-extensions disable pop-shell@system76.com
fi

# Enable Shatter Shell
if gnome-extensions list | grep shatter-shell@adilhanney.com; then
    gnome-extensions enable shatter-shell@adilhanney.com
else
    echo "Warning: Cannot activate freshly installed extension. Please log out, log in, and try again."
fi
