/**
 * Browser entry for the settings tab (the esbuild entry point; Node never
 * imports this file — the tests import `client.js` directly).
 *
 * Pulls the page's CSS sheet as a text module (the build config maps
 * `loader: { '.css': 'text' }`) and injects it once as a `<style>` tag before
 * the plugin face is handed to the module system, so the first render is
 * already styled. Node's own `type: 'text'` import support sits behind
 * `--experimental-import-text`, which is why the CSS import lives in this
 * entry file instead of `client.js`.
 *
 * @module dsh-qwen38-local-qol/client-entry
 */
import cssText from './client.css'
import { apply, compactionStatusCopy, compactionStatusState, inject, name, toDraft } from './client.js'

// Inject the page sheet once per document. The settings dialog may remount
// the section (tab switch, plugin update) without a page reload, so the
// guard is on the marker, not on module identity.
if (typeof document !== 'undefined' && document.querySelector('style[data-dsh-qol]') === null) {
  const style = document.createElement('style')
  style.setAttribute('data-dsh-qol', '')
  style.textContent = cssText
  document.head.appendChild(style)
}

export { apply, compactionStatusCopy, compactionStatusState, inject, name, toDraft }
