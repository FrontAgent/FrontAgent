import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;

module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    min-height: 100vh;
    margin: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      'Helvetica Neue', Arial, 'Noto Sans', 'Liberation Sans', sans-serif;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    color: rgb(17 24 39);
    background-color: rgb(255 255 255);
  }
}