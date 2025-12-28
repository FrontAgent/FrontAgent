import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
var toUrlString = function (value) {
    if (!value)
        return undefined;
    var trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
};
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var apiProxyTarget = toUrlString(process.env.VITE_API_PROXY_TARGET);
    var apiProxy = apiProxyTarget
        ? {
            target: apiProxyTarget,
            changeOrigin: true,
            rewrite: function (p) { return p.replace(/^\/api/, ''); },
        }
        : undefined;
    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'src'),
            },
        },
        envPrefix: ['VITE_'],
        define: {
            __APP_ENV__: JSON.stringify(mode),
        },
        server: {
            port: 5173,
            strictPort: true,
            proxy: apiProxy
                ? {
                    '/api': apiProxy,
                }
                : undefined,
        },
        build: {
            outDir: 'dist',
        },
    };
});
