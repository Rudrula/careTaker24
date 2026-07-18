// Plain Expo default config. This app previously had custom watchFolders /
// nodeModulesPaths here for npm-workspaces monorepo support — removed
// because mobile/ is no longer part of an npm workspace (see the root
// README for why), so there's no longer a separate root node_modules for
// Metro to need to look inside. Using Expo's own default here is the
// most reliable, battle-tested option now that it's all this project needs.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
