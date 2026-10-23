// Generates the PWA icons from the user-supplied app icon (run: npm run icons).
// Output files are written next to the source image, in public/images/.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // The source icon already has a full-bleed background with the artwork inside the safe zone,
    // so no extra padding is needed for maskable and Apple icons.
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/images/app-icon.png'],
});
