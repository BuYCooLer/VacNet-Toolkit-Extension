import preact from '@preact/preset-vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  imports: false,
  manifest: {
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'ru',
    permissions: ['storage'],
    host_permissions: ['https://www.counter-strike.net/vacnet/clips*'],
    icons: {
      "128": "icon.png"
    }
  },
  vite: () => ({
    plugins: [preact({ reactAliasesEnabled: false })],
  }),
});
