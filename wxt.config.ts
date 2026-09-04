import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

export default defineConfig({
  vite: () => ({
    plugins: [preact() as any],
    build: {
      modulePreload: false,
    },
  }),
  manifest: {
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    version: '2.3.0',
    default_locale: 'ru',
    icons: {
      128: 'icon.png',
    },
    permissions: ['storage', 'tabs'],
    host_permissions: [
      'https://www.counter-strike.net/vacnet/clips*',
      'https://replay-video.valve.net/*',
    ],
    browser_specific_settings: {
      gecko: {
        id: 'vacnet-toolkit@buycooler',
        strict_min_version: '109.0',
      },
    },
    background: {
      service_worker: 'background.js',
      scripts: ['background.js'],
    },
    web_accessible_resources: [
      {
        resources: ['content-scripts/extension-ui.css', '_locales/*/messages.json'],
        matches: ['https://www.counter-strike.net/*'],
      },
    ],
  },
});
