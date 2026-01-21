import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { apiPlugin } from './server/apiPlugin';

export default defineConfig({
  plugins: [tailwindcss(), react(), apiPlugin()],
});
