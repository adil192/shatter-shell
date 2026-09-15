/* eslint-disable @typescript-eslint/no-unused-vars */

declare module 'resource:///org/gnome/shell/ui/screenShield.js' {
    import type { Misc } from '@girs/gnome-shell';

    // https://github.com/GNOME/gnome-shell/blob/main/js/ui/screenShield.js
    export class ScreenShield extends Misc.signals.EventEmitter {
        constructor() { }

        showDialog() { }

        get locked(): boolean { }

        get active(): boolean { }

        get activationTime(): number { }

        deactivate(animate: boolean) { }

        activate(animate) { }

        addCredentialManager(serviceName, credentialManager) { }

        removeCredentialManager(serviceName) { }

        lock(animate) { }

        lockIfWasLocked() { }
    }

    export default ScreenShield;
}
