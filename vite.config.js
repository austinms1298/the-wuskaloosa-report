import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // styles.css is already minified in source; disable the build-time CSS
    // minifier so we don't depend on platform-specific native binaries
    // (lightningcss ships darwin/linux/win binaries separately).
    // Cloudflare Pages runs its own `npm install` on Linux x64 so it will
    // have the correct lightningcss binary and can flip this back to true.
    cssMinify: false,
    rollupOptions: {
      input: {
        main:     resolve(import.meta.dirname, 'index.html'),
        about:    resolve(import.meta.dirname, 'about.html'),
        archive:  resolve(import.meta.dirname, 'archive.html'),
        schedule: resolve(import.meta.dirname, 'schedule.html'),
        post:      resolve(import.meta.dirname, 'post.html'),
        subscribe: resolve(import.meta.dirname, 'subscribe.html'),
        '404':     resolve(import.meta.dirname, '404.html'),
      }
    }
  }
});
