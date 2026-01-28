import type { Plugin } from 'vite';
import { handleApiRequest } from './routes';

export const apiPlugin = (): Plugin => ({
  name: 'codex-formatter-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url) return next();
      if (!req.url.startsWith('/api/')) return next();

      const handled = await handleApiRequest(req, res);
      if (!handled) next();
    });
  },
});
