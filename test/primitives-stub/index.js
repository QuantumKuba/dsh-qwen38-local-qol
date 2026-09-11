/**
 * Node-test stand-in for `@deepseek-ai/dsh-client-ui-primitives`.
 *
 * The real package's static lib keeps its third-party imports (clsx, shiki,
 * katex, ...) bare for the shell's Vite build, so importing it under
 * `node --test` would need the whole browser dependency tree. The tests never
 * render the controls — they only need the four components `src/client.js`
 * imports to exist as functions. The browser bundle always gets the real
 * package from the host's module table; this stub is reachable from Node
 * only, through the `file:` devDependency.
 */
export const Button = () => null
export const Input = () => null
export const StateDot = () => null
export const Switch = () => null
