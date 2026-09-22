# SvelteKit template

Provisioned from [`Qode-Platform/fleet-template-v1`](https://github.com/Qode-Platform/fleet-template-v1) — the fleet
lifecycle contract (`bin/`, `fleet.conf`, deploy workflows) with a
SvelteKit starter laid on top.

## Origin

    npx sv@latest create sveltekit --template minimal --types ts --no-install

Generated 2026-09-21 on Node v22.12.0 / Python 3.12.3. **Dependencies were
never installed and this has never been built or run.** Boot it once before
trusting it.

## Fleet lifecycle

`fleet.conf` drives every script in `bin/`:

| step | command |
|---|---|
| install | `npm install` |
| build | `npm run build` |
| start | `node build/index.js` |

    ./bin/run       # install, build, start in the foreground
    ./bin/start     # start from existing build artifacts
    ./bin/restart   # rebuild and restart
    ./bin/stop      # stop whatever holds the port

Listens on `$PORT` (default `3000`); health check hits `/`.

## BASE_PATH

The fleet injects `BASE_PATH` (`/direct/<agent>:<port>`) and nginx forwards
that prefix **unchanged** — so this app serves every route and asset under
it. An empty or unset value means standalone mode: serve at the host root.

- SvelteKit `paths.base` in vite.config.ts, baked at BUILD time.
- `HEALTH_PATH` in `fleet.conf` stays un-prefixed; the fleet prepends `$BASE_PATH` itself.
- A value like `direct/x:3000/` is normalised to `/direct/x:3000`.

## What differs from stock output

- Swapped @sveltejs/adapter-auto for @sveltejs/adapter-node in vite.config.ts and package.json — adapter-auto fails the build outside a recognised host.

---

# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.17.1 create --template minimal --types ts --no-install sveltekit
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Rule: everything under BASE_PATH

This app is not served at the host root. The fleet ingress serves it under a
proxy prefix and forwards that prefix **unchanged**:

```
BASE_PATH=/direct/<agent>:<port>
```

**Every API call and every asset reference must carry that base path.** A bare
`"/..."` literal resolves against the host root, so it works on localhost and
404s in the fleet.

**What SvelteKit rewrites for you:** route resolution and `data-sveltekit`
navigation via `paths.base` (set from `BASE_PATH` in `vite.config.ts`), Vite's
handling of imported assets (`import favicon from '$lib/assets/favicon.svg'`),
and the bundle/`%sveltekit.assets%` URLs injected into `src/app.html`.

**What is NOT rewritten:** `fetch`/XHR URLs, hand-written `href=` and `src=`
string literals in `.svelte` markup, CSS `url(...)`, and anything else built
from a string in code.

**Use this framework's mechanism:** `base` from `$app/paths`.

```svelte
<script lang="ts">
  import { base } from '$app/paths';
  const items = fetch(`${base}/api/items`);
</script>

<a href="{base}/about">About</a>
```

**Verify with:**

```bash
npm run check:base-path
```

A line that is genuinely framework-handled can be exempted with a trailing
`base-path-ok` comment (say why).
