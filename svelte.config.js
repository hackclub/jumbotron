import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			fallback: '404.html'
		}),
		paths: {
			// GitHub Pages lives at /jumbotron; Vercel serves the project at the domain root
			base: process.env.VERCEL ? '' : '/jumbotron'
		}
	}
};

export default config;