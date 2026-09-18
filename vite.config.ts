import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

import fs from 'fs';

// Plugin para gerar o version.json
function versionPlugin() {
  return {
    name: 'generate-version-json',
    buildStart() {
      const version = { version: Date.now().toString() };
      if (!fs.existsSync('public')) {
        fs.mkdirSync('public');
      }
      fs.writeFileSync('public/version.json', JSON.stringify(version, null, 2));
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    versionPlugin()
  ],
})
