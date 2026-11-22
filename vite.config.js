import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// `npm run dev` runs the API on :3000 next to Vite; the frontend calls it at /api.
		proxy: { '/api': 'http://localhost:3000' }
	}
});
