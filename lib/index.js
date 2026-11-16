/**
 * Host half of the dsh-color-style bundle.
 *
 * The ten palettes, the token layer, the injected stylesheet and the stored
 * selection are presentation concerns of the web client. The Host side owns
 * one thing: the taskbar attention flash shown when a root Session finishes a
 * turn while the DSH window is not focused (`config.taskbarFlash`).
 *
 * @module dsh-color-style
 */

import { installTaskbarFlash } from './taskbar-flash.js'

/** Plugin id; equals the package name and the Loader row id. */
export const name = 'dsh-color-style'

/**
 * Mount the plugin.
 *
 * @param {object} ctx - the Host context of this Loader row.
 * @param {unknown} config - the row's `config`; only `taskbarFlash` is read.
 */
export function apply(ctx, config) {
  ctx.effect(() =>
    installTaskbarFlash(ctx, config !== null && typeof config === 'object' ? config.taskbarFlash : undefined, {
      logger: ctx.logger,
    }),
  )
}

export default { name, apply }
