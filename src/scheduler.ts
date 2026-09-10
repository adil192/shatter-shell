import * as log from './log.js';

import Gio from 'gi://Gio';
import Meta from 'gi://Meta';

const SchedulerInterface =
    '<node>\
<interface name="com.system76.Scheduler"> \
    <method name="SetForegroundProcess"> \
        <arg name="pid" type="u" direction="in"/> \
    </method> \
</interface> \
</node>';

const SchedulerProxy = Gio.DBusProxy.makeProxyWrapper(SchedulerInterface);

const SchedProxy: ReturnType<typeof SchedulerProxy>
    /** @ts-expect-error TypeScript bindings don't have `new` keyword */
    = new SchedulerProxy(Gio.DBus.system, 'com.system76.Scheduler', '/com/system76/Scheduler');

let foreground: number = 0;
let failed: boolean = false;

export function setForeground(win: Meta.Window) {
    if (failed) return;

    const pid = win.get_pid();
    if (pid) {
        if (foreground === pid) return;
        foreground = pid;

        try {
            SchedProxy.SetForegroundProcessRemote(pid, (_result: unknown, error: unknown, _fds: unknown) => {
                if (error !== null) errorHandler(error);
            });
        } catch (error) {
            errorHandler(error);
        }
    }
}

function errorHandler(error: unknown) {
    // TODO: Remove system76-scheduler
    log.warn(`system76-scheduler may not be installed and running: ${error}`);
    failed = true;
}
