#!/usr/bin/gjs --module

import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk?version=4.0';

/** Add our directory so we can import modules from it. */
const SCRIPT_DIR = GLib.path_get_dirname(new Error().stack!.split(':')[0]!.slice(1));
imports.searchPath.push(SCRIPT_DIR);

import * as config from '../config.js';

const WM_CLASS_ID = 'org.gnome.shell.extensions.shatter-shell.exceptions';

interface SelectWindow {
    tag: 'select';
}

interface SwitchPage {
    tag: 'switch-page';
    page: 'main' | 'exceptions';
}

interface ToggleException {
    tag: 'toggle-exception';
    wmclass: string | undefined;
    wmtitle: string | undefined;
    enable: boolean;
}

interface RemoveException {
    tag: 'remove-exception';
    wmclass: string | undefined;
    wmtitle: string | undefined;
}

type Event = SelectWindow | SwitchPage | ToggleException | RemoveException;

function new_system_exceptions_button(): Adw.ActionRow {
    const row = new Adw.ActionRow({
        title: 'System Exceptions',
        subtitle: 'Updated based on validated user reports.',
        activatable: true,
    });

    const icon = new Gtk.Image({
        icon_name: 'go-next-symbolic',
    });
    row.add_suffix(icon);

    return row;
}

const MainPage = GObject.registerClass(class MainPage extends Adw.NavigationPage {
    private readonly preferencesGroup;
    private readonly callback;

    constructor(callback: (event: Event) => void) {
        super({
            title: 'Floating Window Exceptions',
        });
        this.callback = callback;

        const toolbarView = new Adw.ToolbarView({});
        toolbarView.add_top_bar(new Adw.HeaderBar());
        this.child = toolbarView;

        const preferencesPage = new Adw.PreferencesPage({
            description: 'Matching windows will not be tiled by Shatter Shell.',
            description_centered: true,
        });
        toolbarView.content = preferencesPage;

        const selectGroup = new Adw.PreferencesGroup({
            description: 'Add an exception by selecting a currently open window.',
        });
        preferencesPage.add(selectGroup);

        const selectButton = new Adw.ButtonRow({
            start_icon_name: 'list-add-symbolic',
            title: 'New exception',
        });
        selectButton.connect('activated', () => callback({ tag: 'select' }));
        selectGroup.add(selectButton);

        this.preferencesGroup = new Adw.PreferencesGroup({
            description: 'Your floating window exceptions',
        });
        preferencesPage.add(this.preferencesGroup);

        const system_exceptions_button = new_system_exceptions_button();
        system_exceptions_button.connect('activated', () => callback({ tag: 'switch-page', page: 'exceptions' }));
        this.preferencesGroup.add(system_exceptions_button);
    }

    add_rule(wmclass: string | undefined, wmtitle: string | undefined) {
        const row = new Adw.ActionRow({
            title: `App: ${wmclass ?? '*'}`,
            subtitle: `Window: ${wmtitle ?? '*'}`,
            activatable: false,
        });
        this.preferencesGroup.add(row);

        const button = new Gtk.Button({
            icon_name: 'user-trash-symbolic',
            valign: Gtk.Align.CENTER,
        });
        button.connect('clicked', () => {
            this.preferencesGroup.remove(row);
            this.callback({ tag: 'remove-exception', wmclass, wmtitle });
        });
        row.add_suffix(button);
    }
});

const ExceptionsPage = GObject.registerClass(class ExceptionsPage extends Adw.NavigationPage {
    private readonly preferencesGroup;
    private readonly callback;

    constructor(callback: (event: Event) => void) {
        super({
            title: 'System Exceptions',
        });
        this.callback = callback;

        const toolbarView = new Adw.ToolbarView({});
        toolbarView.add_top_bar(new Adw.HeaderBar());
        this.child = toolbarView;

        const preferencesPage = new Adw.PreferencesPage({
            description: 'Exceptions built into the extension,\nupdated based on validated user reports.',
            description_centered: true,
        });
        toolbarView.content = preferencesPage;

        this.preferencesGroup = new Adw.PreferencesGroup();
        preferencesPage.add(this.preferencesGroup);
    }

    add_rule(wmclass: string | undefined, wmtitle: string | undefined, enabled: boolean) {
        const row = new Adw.SwitchRow({
            title: `App: ${wmclass ?? '*'}`,
            subtitle: `Window: ${wmtitle ?? '*'}`,
            active: enabled,
        });
        row.connect('notify::active', () => {
            this.callback({ tag: 'toggle-exception', wmclass, wmtitle, enable: row.active });
        });
        this.preferencesGroup.add(row);
    }
});

class App {
    readonly nav;
    readonly main_page;
    readonly exceptions_page;
    readonly config = new config.Config();

    constructor(private readonly application: Adw.Application) {
        this.main_page = new MainPage(this.event_handler.bind(this));
        this.exceptions_page = new ExceptionsPage(this.event_handler.bind(this));

        this.nav = new Adw.NavigationView();
        this.nav.add(this.main_page);
        this.nav.add(this.exceptions_page);

        const win = new Adw.ApplicationWindow({
            application,
            title: 'Floating Window Exceptions',
            modal: true,
            default_width: 550,
            default_height: 700,
            content: this.nav,
        });

        this.config.reload();

        for (const value of config.DEFAULT_FLOAT_RULES.values()) {
            const wmtitle = value.title;
            const wmclass = value.class;

            const disabled = this.config.rule_disabled({ class: wmclass, title: wmtitle });
            this.exceptions_page.add_rule(wmclass, wmtitle, !disabled);
        }

        for (const value of Array.from(this.config.float)) {
            const wmtitle = value.title;
            const wmclass = value.class;
            if (!(value.disabled ?? false)) this.main_page.add_rule(wmclass, wmtitle);
        }

        win.present();
    }

    event_handler(event: Event) {
        switch (event.tag) {
            case 'select':
                println('SELECT');
                this.application.quit();
                break;

            case 'switch-page':
                switch (event.page) {
                    case 'main':
                        this.nav.pop();
                        break;
                    case 'exceptions':
                        this.nav.push(this.exceptions_page);
                        break;
                }

                break;

            case 'toggle-exception':
                log(`toggling exception ${event.enable}`);
                this.config.toggle_system_exception(event.wmclass, event.wmtitle, !event.enable);
                println('MODIFIED');
                break;

            case 'remove-exception':
                log(`removing exception`);
                this.config.remove_user_exception(event.wmclass, event.wmtitle);
                println('MODIFIED');
                break;
        }
    };
}

/** We'll use stdout for printing events for the shell to handle */
const STDOUT = new Gio.DataOutputStream({
    base_stream: new GioUnix.OutputStream({ fd: 1 }),
});

/** Utility function for printing a message to stdout with an added newline */
function println(message: string) {
    STDOUT.put_string(message + '\n', null);
}

/** Initialize GTK and start the application */
function main() {
    const application = new Adw.Application({
        application_id: WM_CLASS_ID,
    });
    application.connect('activate', () => new App(application));
    return application.run(null);
}

main();
