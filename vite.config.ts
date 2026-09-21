import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Fleet contract: nginx forwards the whole /direct/<agent>:<port> prefix
// UNCHANGED, so SvelteKit must resolve every route and asset under it.
// `paths.base` is baked at BUILD time. Empty/unset => serve at the host root.
const raw = (process.env.BASE_PATH ?? '').trim();
const basePath = raw ? `/${raw.replace(/^\/+|\/+$/g, '')}` : '';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-node: the fleet runs `node build/index.js`. adapter-auto
			// cannot detect this host and fails the build.
			adapter: adapter(),

			// Serve under the fleet's ingress prefix when one is injected.
			paths: { base: basePath }
		})
	]
});
