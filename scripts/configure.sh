#!/bin/bash

set -ex

shortcut_applied() {
    # Check if user confirmed overriding shortcuts
    if test -f "./.confirm_shortcut_change"; then
        echo "Shortcut change already confirmed"
        return 0
    fi

    read -rp "Shatter Shell will override your default shortcuts. Are you sure? (y/n) " CONT
    if test "$CONT" = "y"; then
        touch "./.confirm_shortcut_change"
        return 1
    else
        echo "Cancelled"
        return 0
    fi
}

set_keybindings() {
    if shortcut_applied; then
        return 0
    fi

    KEYS_GNOME_WM=/org/gnome/desktop/wm/keybindings
    KEYS_GNOME_SHELL=/org/gnome/shell/keybindings
    KEYS_MUTTER=/org/gnome/mutter/keybindings
    KEYS_MEDIA=/org/gnome/settings-daemon/plugins/media-keys
    KEYS_MUTTER_WAYLAND_RESTORE=/org/gnome/mutter/wayland/keybindings/restore-shortcuts

    # Disable incompatible shortcuts
    # Restore the keyboard shortcuts: disable <Super>Escape
    dconf write ${KEYS_MUTTER_WAYLAND_RESTORE} "@as []"
    # Toggle message tray: disable <Super>m, retain <Super>v
    dconf write ${KEYS_GNOME_SHELL}/toggle-message-tray "@as ['<Super>v']"
    # Toggle quick settings: disable <Super>s
    dconf write ${KEYS_GNOME_SHELL}/toggle-quick-settings "@as []"
    # Maximize window: disable <Super>Up
    dconf write ${KEYS_GNOME_WM}/maximize "@as []"
    # Restore window: disable <Super>Down, retain <Alt>F5
    dconf write ${KEYS_GNOME_WM}/unmaximize "@as ['<Alt>F5']"

    # Move to monitor up: disable <Super><Shift>Up
    dconf write ${KEYS_GNOME_WM}/move-to-monitor-up "@as []"
    # Move to monitor down: disable <Super><Shift>Down
    dconf write ${KEYS_GNOME_WM}/move-to-monitor-down "@as []"
    # Move to monitor left: disable <Super><Shift>Left
    dconf write ${KEYS_GNOME_WM}/move-to-monitor-left "@as []"
    # Move to monitor right: disable <Super><Shift>Right
    dconf write ${KEYS_GNOME_WM}/move-to-monitor-right "@as []"

    # Disable tiling to left / right of screen
    dconf write ${KEYS_MUTTER}/toggle-tiled-left "@as []"
    dconf write ${KEYS_MUTTER}/toggle-tiled-right "@as []"

    # Toggle maximization state: changed from <Alt>F10
    dconf write ${KEYS_GNOME_WM}/toggle-maximized "['<Super>m', '<Alt>F10']"
    # Lock screen: changed from <Super>l
    dconf write ${KEYS_MEDIA}/screensaver "['<Super>Escape', '<Super>l']"
    # Toggle automatic screen orientation: disable <Super>o, retain XF86RotationLockToggle
    dconf write ${KEYS_MEDIA}/rotate-video-lock-static "@as ['XF86RotationLockToggle']"

    # Close window: changed from <Alt>F4
    dconf write ${KEYS_GNOME_WM}/close "['<Super>q', '<Alt>F4']"
}

if ! command -v gnome-extensions >/dev/null; then
    echo 'You must install gnome-extensions to configure or enable via this script' \
        '(`gnome-shell` on Debian systems, `gnome-extensions` on openSUSE systems.)'
    exit 1
fi

set_keybindings

# Make sure user extensions are enabled
dconf write /org/gnome/shell/disable-user-extensions false

# Use a window placement behavior which works better for tiling (https://extensions.gnome.org/extension/18/native-window-placement/)
if gnome-extensions list | grep native-window-placement@gnome-shell-extensions.gcampax.github.com; then
    gnome-extensions enable native-window-placement@gnome-shell-extensions.gcampax.github.com
fi

# Workspaces spanning displays works better with Shatter Shell
dconf write /org/gnome/mutter/workspaces-only-on-primary false
