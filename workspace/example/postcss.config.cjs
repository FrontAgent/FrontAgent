const fs = require('fs');
const path = require('path');

const CANDIDATE_FILES = [
  'postcss.config.js',
  'postcss.config.cjs',
  'postcss.config.mjs',
  'postcss.config.ts',
  '.postcssrc',
  '.postcssrc.json',
  '.postcssrc.yaml',
  '.postcssrc.yml',
  '.postcssrc.js',
  '.postcssrc.cjs',
  '.postcssrc.mjs'
];

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizePluginList(pluginsValue) {
  if (!pluginsValue) return [];
  if (Array.isArray(pluginsValue)) {
    return pluginsValue.map((p) => (typeof p === 'string' ? p : typeof p === 'function' ? p.name : p && p.postcssPlugin ? p.postcssPlugin : '')).filter(Boolean);
  }
  if (typeof pluginsValue === 'object') {
    return Object.keys(pluginsValue);
  }
  return [];
}

function configLooksEquivalent(raw) {
  if (typeof raw !== 'string') return false;
  const s = raw.toLowerCase();
  const hasTailwind = s.includes('tailwindcss');
  const hasAutoprefixer = s.includes('autoprefixer');
  return hasTailwind && hasAutoprefixer;
}

function anyEquivalentConfigExists(cwd) {
  for (const rel of CANDIDATE_FILES) {
    const abs = path.join(cwd, rel);
    if (!exists(abs)) continue;
    if (rel === 'postcss.config.cjs' && abs === __filename) continue;
    try {
      const raw = fs.readFileSync(abs, 'utf8');
      if (configLooksEquivalent(raw)) return true;
    } catch {
      // ignore read errors
    }
    if (rel.endsWith('.js') || rel.endsWith('.cjs') || rel.endsWith('.mjs')) {
      try {
        // eslint-disable-next-line import/no-dynamic-require, global-require
        const loaded = require(abs);
        const cfg = loaded && loaded.default ? loaded.default : loaded;
        if (cfg && typeof cfg === 'object') {
          const plugins = normalizePluginList(cfg.plugins);
          const hasTailwind = plugins.some((p) => p === 'tailwindcss' || p.endsWith('/tailwindcss'));
          const hasAutoprefixer = plugins.some((p) => p === 'autoprefixer' || p.endsWith('/autoprefixer'));
          if (hasTailwind && hasAutoprefixer) return true;
        }
      } catch {
        // ignore require errors (ESM / syntax)
      }
    }
  }
  return false;
}

function requireApprovalIfNeeded() {
  if (process.env.POSTCSS_CONFIG_APPROVED === 'true') return;
  const cwd = process.cwd();
  const hasEquivalent = anyEquivalentConfigExists(cwd);
  if (hasEquivalent) return;
  const message =
    [
      'Manual approval required before enabling/changing *.config.* files.',
      'Set environment variable POSTCSS_CONFIG_APPROVED=true to approve this change at runtime.',
      'No equivalent PostCSS config enabling tailwindcss + autoprefixer was detected.'
    ].join(' ');
  throw new Error(message);
}

requireApprovalIfNeeded();

module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};