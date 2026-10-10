import * as result from './result.js';
import * as error from './error.js';
import * as log from './log.js';

import Cogl from 'gi://Cogl';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
const { Ok, Err } = result;
const { Error } = error;

export function block_signal(object: GObject.Object, signal: SignalID) {
    GObject.signal_handler_block(object, signal);
}

export function unblock_signal(object: GObject.Object, signal: SignalID) {
    GObject.signal_handler_unblock(object, signal);
}

export function read_to_string(path: string): result.Result<string, error.Error> {
    const file = Gio.File.new_for_path(path);
    try {
        const [ok, contents] = file.load_contents(null);
        if (ok) {
            return Ok(imports.byteArray.toString(contents));
        } else {
            return Err(new Error(`failed to load contents of ${path}`));
        }
    } catch (e) {
        return Err(new Error(String(e)).context(`failed to load contents of ${path}`));
    }
}

export function exists(path: string): boolean {
    return Gio.File.new_for_path(path).query_exists(null);
}

/**
 * Whether `color` is dark based on its WCAG relative luminance.
 * https://stackoverflow.com/a/41491220 - the advanced solution
 * @param color - the RGBA or hex string value
 * @returns Whether the color is dark
 */
export function is_dark(color: Cogl.Color): boolean {
    /// Maps an sRGB component to its linear intensity.
    const linearize = (c: number) => c <= 0.04045
        ? c / 12.92
        : Math.pow((c + 0.055) / 1.055, 2.4);

    const luminance
        = 0.2126 * linearize(color.get_red())
        + 0.7152 * linearize(color.get_green())
        + 0.0722 * linearize(color.get_blue());

    return luminance <= 0.179;
}

export function async_process_ipc(argv: Array<string>) {
    const { SubprocessLauncher, SubprocessFlags } = Gio;

    const launcher = new SubprocessLauncher({
        flags: SubprocessFlags.STDIN_PIPE | SubprocessFlags.STDOUT_PIPE,
    });

    let child: Gio.Subprocess;
    try {
        child = launcher.spawnv(argv);
    } catch (why) {
        log.error(`failed to spawn ${argv}: ${why}`);
        return null;
    }

    const stdin = new Gio.DataOutputStream({
        base_stream: child.get_stdin_pipe()!,
        close_base_stream: true,
    });

    const stdout = new Gio.DataInputStream({
        base_stream: child.get_stdout_pipe()!,
        close_base_stream: true,
    });

    const cancellable = new Gio.Cancellable();
    child.wait_async(null, (source, res) => {
        source?.wait_finish(res);
        cancellable.cancel();
    });

    return { child, stdin, stdout, cancellable };
}

export function map_eq<K, V>(map1: Map<K, V>, map2: Map<K, V>) {
    if (map1.size !== map2.size) {
        return false;
    }

    let cmp;

    for (const [key, val] of map1) {
        cmp = map2.get(key);
        if (cmp !== val || (cmp == undefined && !map2.has(key))) {
            return false;
        }
    }

    return true;
}
