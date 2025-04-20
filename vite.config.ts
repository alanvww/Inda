import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// Removed VitePluginNode import

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
			manifest: {
				name: 'Inda by Alan Ren',
				short_name: 'Inda',
				description: 'Inda',
				theme_color: '#202020',
				background_color: '#ffffff',
				icons: [
					{
						src: '/icons/icon-192x192.png',
						sizes: '192x192',
						type: 'image/png',
					},
					{
						src: '/icons/icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
					},
				],
			},
			strategies: 'generateSW',
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-cache',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
							},
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
					{
						urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-cache',
							networkTimeoutSeconds: 10,
							expiration: {
								maxEntries: 50,
								maxAgeSeconds: 60 * 60, // 1 hour
							},
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
				],
				navigateFallback: 'index.html',
				navigateFallbackDenylist: [/^\/icons\//],
			},
		}),
		// Removed VitePluginNode configuration
	],
	// Ensure environment variables from .env are loaded for the server-side API route
	// Vite loads .env files by default, but explicitly defining might help clarity
	// Note: VITE_ prefix is NOT needed for server-side env vars accessed via process.env
	envPrefix: 'VITE_', // Keep this for client-side variables
	// Optional: Define server-specific options if needed, like port
	// server: {
	//   port: 5174 // Your current port
	// },
	// Configure Vite's development server proxy
	server: {
		proxy: {
			// Proxy requests starting with '/api'
			'/api': {
				// Target the standalone Bun server. Use LOCAL_BACKEND_URL env var if set, otherwise default.
				target: process.env.LOCAL_BACKEND_URL || 'http://localhost:3001',
				// Change origin header to match the target URL
				changeOrigin: true,
				// Remove the '/api' prefix when forwarding the request
				// So, a request to '/api/gemini' becomes a request to '/' on the target Bun server
				rewrite: (path) => path.replace(/^\/api/, ''),
			},
		},
		allowedHosts: ['inda-production.up.railway.app', 'localhost','inda.alan.ooo'],
	},
});
