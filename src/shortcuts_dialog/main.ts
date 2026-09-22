#!/usr/bin/gjs --module

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw';

import { AdjustmentModePage } from './adjustment_mode_page.js';
import { ManipulateWindowPage } from './manipulate_window_page.js';
import { WorkspacesAndDisplaysPage } from './workspaces_and_displays_page.js';

const WM_CLASS_ID = 'org.gnome.shell.extensions.shatter-shell.shortcuts';

const AppWindow = GObject.registerClass(class AppWindow extends Adw.ApplicationWindow {
    constructor(application: Adw.Application) {
        super({
            application,
            title: 'Shatter Shell Shortcuts',
            modal: true,
            default_width: 960,
            default_height: 720,
        });
        this.set_size_request(960, 720);

        const toolbar_view = new Adw.ToolbarView({
            hexpand: true,
            vexpand: true,
        });
        this.content = toolbar_view;

        const stack = new Adw.ViewStack({
            enable_transitions: true,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 32,
            margin_end: 32,
            halign: Gtk.Align.CENTER,
        });
        toolbar_view.content = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            child: stack,
        });

        const topSwitcher = new Adw.ViewSwitcher({ stack, policy: Adw.ViewSwitcherPolicy.WIDE });
        toolbar_view.add_top_bar(new Adw.HeaderBar({ title_widget: topSwitcher }));

        const settingsHint = new Gtk.Label({
            label: 'Keyboard shortcuts can be customized in Settings.',
            margin_top: 16,
            margin_bottom: 16,
            margin_start: 16,
            margin_end: 16,
        });
        toolbar_view.add_bottom_bar(settingsHint);

        const manipulateWindowPage = new ManipulateWindowPage();
        stack.add_titled_with_icon(manipulateWindowPage, 'manipulate_windows', 'Manipulate windows', 'window-symbolic');

        const adjustmentModePage = new AdjustmentModePage();
        stack.add_titled_with_icon(adjustmentModePage, 'adjustment_mode', 'Adjustment mode', 'typing-symbolic');

        const workspacesAndDisplaysPage = new WorkspacesAndDisplaysPage();
        stack.add_titled_with_icon(workspacesAndDisplaysPage, 'workspaces_and_displays', 'Workspaces and displays', 'video-joined-displays-symbolic');

        this.present();
    }
});

function main() {
    const application = new Adw.Application({
        application_id: WM_CLASS_ID,
    });
    application.connect('activate', () => new AppWindow(application));
    return application.run(null);
}

main();
