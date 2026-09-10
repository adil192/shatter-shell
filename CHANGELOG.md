## 2.0.0

- **Features**:
  - Rebranded from Pop Shell to Shatter Shell.
  - Added GNOME 51 support.
  - Added a setting to stop Shatter Shell from resetting your windows' positions when untiling.
  - Adwaita-themed tab bar for stacked windows: the tabs are bigger and easier to click, and fit in better with GNOME.
  - Added a fade transition when switching between stacked windows.
- **Removals**:
  - Removed pop-launcher (Super+/) integration in favor of GNOME's overview.
  - Removed system76-scheduler integration, since it's not common outside of Pop!_OS.
  - Removed the "Show Minimize to Tray Windows" setting in favor of stock GNOME Alt+Tab behavior.
  - Removed the "Show Window Titles" setting since it does nothing on Wayland.
- **Fixes**:
  - Fixed some tiling jank with a fixed [`area_right` function](https://github.com/adil192/shatter-shell/blob/63f0fa4df67182119b2c54b2377f1290e2ec2063/src/fork.ts#L77).
    This can possibly be upstreamed but needs benchmarking to see if it's actually an improvement or just placebo.
  - Fixed brief flickers in active hints when tiling/untiling/moving windows.
- **Floating window exceptions**:
  - New: Steam sign-in dialog
  - New: Firefox Picture-in-Picture windows
  - New: Git Credential Manager login popups
  - New: Firefox "About" dialog
  - Fixed: Floating Window Exceptions config window
- **Technical**:
  - Replaced manual `.d.ts` bindings with [gjsify/gnome-shell](https://github.com/gjsify/gnome-shell).
  - Updated to [Typescript 7](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) for 10x faster builds and type checking.
  - Enabled eslint for code style and reducing dynamic types.
  - Removed legacy code for X11 and old GNOME versions (3.x). This is now Wayland only, just like GNOME.
  - Added some basic CI to make sure code at least compiles.
