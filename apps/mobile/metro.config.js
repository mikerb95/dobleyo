// Metro configurado para monorepo (npm workspaces).
// Observa la raíz del repo y resuelve módulos hoisteados al node_modules raíz.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Observar todo el monorepo para detectar cambios en packages/shared.
config.watchFolders = [monorepoRoot];

// 2. Resolver módulos desde el node_modules de la app y el de la raíz.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
