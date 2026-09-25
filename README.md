# Shatter Shell

Shatter Shell is a keyboard-driven layer for GNOME Shell which allows for quick and sensible navigation and management of windows. The core feature of Shatter Shell is the addition of advanced tiling window management — a feature that has been highly sought within our community. For many — ourselves included — i3wm has become the leading competitor to the GNOME desktop.

Tiling window management in GNOME is virtually nonexistent, which makes the desktop awkward to interact with when your needs exceed that of two windows at a given time. Luckily, GNOME Shell is an extensible desktop with the foundations that make it possible to implement a tiling window manager on top of the desktop.

Therefore, we see an opportunity here to advance the usability of the GNOME desktop to better accommodate the needs of our community with Shatter Shell. Advanced tiling window management is a must for the desktop, so we've merged i3-like tiling window management with the GNOME desktop for the best of both worlds.

[![](./screenshot.webp)](https://raw.githubusercontent.com/adil192/shatter-shell/refs/heads/master_resolute/screenshot.webp)

## Fork notice

This is a fork of the original [pop-os/shell](https://github.com/pop-os/shell) repo,
which is no longer being developed<sup>[source](https://github.com/pop-os/shell/issues/1829#issuecomment-5511896163)</sup>.

Find a summary of this fork's main improvements in the [2.0.0 release](https://github.com/adil192/shatter-shell/releases/tag/2.0.0) and incremental improvements in the [other releases](https://github.com/adil192/shatter-shell/releases).

## Installation

### Install on Fedora (and derivatives)

Shatter Shell is included in the [Terra](https://terrapkg.com/) community repo.
Run the following to install:

```bash
# Add the Terra repo if you haven't already
sudo dnf install --nogpgcheck --repofrompath 'terra,https://repos.fyralabs.com/terra$releasever' terra-release

# Uninstall Pop Shell if you have it
sudo dnf remove gnome-shell-extension-pop-shell

# Install Shatter Shell
sudo dnf install gnome-shell-extension-shatter-shell
```

After logging out and back in,
enable the extension in [Extension Manager](https://flathub.org/en/apps/com.mattjakeman.ExtensionManager).
Alternatively, run `gnome-extensions enable shatter-shell@adilhanney.com` in a terminal.

### Build from source

Run the following to build Shatter Shell from source:

```bash
# Install the dependencies, e.g. for Fedora:
sudo dnf install make npm

# Clone the source code
git clone https://github.com/adil192/shatter-shell.git
cd shatter-shell

# Build and install
make local-install
```

After logging out and back in,
enable the extension in [Extension Manager](https://flathub.org/en/apps/com.mattjakeman.ExtensionManager).
Alternatively, run `gnome-extensions enable shatter-shell@adilhanney.com` in a terminal.

Feel free to delete the source code after installing.

Additional notes:
- If you are planning on developing Shatter Shell, see [Developing](#Developing) below.
- If you want to uninstall the extension, run `make uninstall`. Then open the "Keyboard Shortcuts" page in GNOME Settings and click the "Reset All..." button.
- If you are packaging for your Linux distribution, many features in Shatter Shell will not work out of the box because they require changes to GNOME's default keyboard shortcuts. You may wish to package some gschema overrides to work around this.

## Developing

Please install the following as dependencies when developing:

- `make`
- [`Node.js`](https://nodejs.org/en/)
- [`dart-sass`](https://sass-lang.com/install/) (optional, for faster builds)
- `mutter-devkit` (optional, for testing)

To test your changes while working on the shell, run `make debug` to start a nested GNOME session. See the documentation at https://gjs.guide/extensions/development/debugging.html.

## License

Licensed under the GNU General Public License, Version 3.0, ([LICENSE](LICENSE) or https://www.gnu.org/licenses/gpl-3.0.en.html)

### Contribution

Any contribution intentionally submitted for inclusion in the work by you shall be licensed under the GNU GPLv3.
