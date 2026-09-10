// Loads a real application module in plain Node, so a test script can exercise
// it instead of reading it as text.
//
// The existing test scripts import a source file through a base64 data: URL,
// which only works for a module with no imports of its own. Anything that
// imports a util or uses a path alias could not be tested at all - which is a
// large part of why the sync engine had no coverage.
//
// This compiles on demand with the project's own Babel setup, so aliases and
// ESM resolve the same way they do in the app.

const fs = require("fs");
const path = require("path");
const Module = require("module");
const { createRequire } = require("module");

const root = path.resolve(__dirname, "..", "..");
const projectRequire = createRequire(path.join(root, "package.json"));
const babel = projectRequire("@babel/core");

const babelConfig = require(path.join(root, "babel.config.js"))({
  cache: () => {},
});
const moduleResolver = (babelConfig.plugins ?? []).find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "module-resolver"
);

const EXTENSIONS = [".js", ".json"];
const cache = new Map();
// Stand-ins for packages a test wants to drive rather than avoid - a fake
// secure store, say. Keyed by the specifier the module imports.
const stubs = new Map();

function resolveFile(target) {
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;

  for (const extension of EXTENSIONS) {
    if (fs.existsSync(target + extension)) return target + extension;
  }

  const index = path.join(target, "index.js");

  return fs.existsSync(index) ? index : null;
}

function compile(file) {
  if (cache.has(file)) return cache.get(file).exports;

  const source = fs.readFileSync(file, "utf8");
  const { code } = babel.transformSync(source, {
    filename: file,
    babelrc: false,
    configFile: false,
    plugins: [
      moduleResolver,
      projectRequire.resolve("@babel/plugin-transform-modules-commonjs"),
    ],
  });

  const compiled = new Module(file, null);
  compiled.filename = file;
  compiled.paths = Module._nodeModulePaths(path.dirname(file));
  cache.set(file, compiled);

  // Anything the module pulls in that is not ours - react-native, expo-sqlite -
  // is replaced by an inert stub. A pure module never touches them; one that
  // does will fail loudly rather than quietly using a half-real dependency.
  compiled.require = (specifier) => {
    if (specifier.startsWith(".") || specifier.startsWith("/")) {
      const resolved = resolveFile(path.resolve(path.dirname(file), specifier));

      if (!resolved) throw new Error(`Cannot resolve ${specifier} from ${file}`);

      return compile(resolved);
    }

    if (stubs.has(specifier)) {
      return stubs.get(specifier);
    }

    try {
      return projectRequire(specifier);
    } catch {
      return new Proxy(
        {},
        {
          get() {
            throw new Error(
              `${file} reached for "${specifier}" at test time; this loader only handles pure modules`
            );
          },
        }
      );
    }
  };

  compiled._compile(code, file);

  return compiled.exports;
}

/** `loadAppModule("src/Services/cloudSync/cloudSyncFields.js")` */
function loadAppModule(relativePath) {
  const file = resolveFile(path.join(root, relativePath));

  if (!file) throw new Error(`No such module: ${relativePath}`);

  return compile(file);
}

/**
 * Replaces a package with a test double for every module loaded afterwards.
 * Call it before loadAppModule; the compiled-module cache is cleared so a
 * module already loaded without the stub is rebuilt with it.
 */
loadAppModule.stubModule = function stubModule(specifier, replacement) {
  stubs.set(specifier, replacement);
  cache.clear();
};

module.exports = loadAppModule;
