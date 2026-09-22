// Every property anybody destructures from useTranslation() has to exist.
//
// SplitCards took `formatDate` from the hook. The hook never returned one -
// formatDate is a module export from @localization - so it came back
// undefined, and calling it crashed Home on launch with "undefined is not a
// function". Only for an account with a real split that has settled weekdays,
// which means only on a phone with months of history. Every device it was tried
// on before release had too little data to reach that line, so the first place
// it failed was the Play build on the one phone holding the data the release
// was meant to rescue.
//
// check-undeclared cannot see this: the name is declared, by the destructure.
// It is the object that does not have it. So this reads what the context value
// actually carries and checks every destructure against it.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const contextSource = fs.readFileSync(
  path.join(root, "src", "Localization", "LocalizationContext.js"),
  "utf8"
);

// The keys of the object handed to the provider.
const valueBlock = contextSource.match(/const value = useMemo\(\s*\(\) => \(\{([\s\S]*?)\}\)/);
assert.ok(valueBlock, "LocalizationContext no longer builds its value with useMemo(() => ({ ... }))");

const provided = new Set(
  [...valueBlock[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*(?::|,|$)/gm)].map((match) => match[1])
);

assert.ok(provided.has("t"), "could not read the context's keys - the parser is looking in the wrong place");

function walk(directory, found = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(full, found);
    } else if (entry.name.endsWith(".js")) {
      found.push(full);
    }
  }

  return found;
}

const problems = [];
let checked = 0;

for (const file of walk(path.join(root, "src"))) {
  const source = fs.readFileSync(file, "utf8");

  for (const match of source.matchAll(/const \{([^}]*)\} = useTranslation\(\)/g)) {
    checked += 1;

    for (const part of match[1].split(",")) {
      // `t`, `t: translate`, `language = "en"` - the key is before any : or =.
      const key = part.trim().split(/[:=\s]/)[0];

      if (key && !provided.has(key)) {
        problems.push(
          `${path.relative(root, file)} takes "${key}" from useTranslation(), which does not provide it - it will be undefined`
        );
      }
    }
  }
}

assert.ok(checked > 10, `only ${checked} uses of useTranslation() found - the search is broken`);

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log(
  `Translation hook: ${checked} destructures, all asking for one of ${[...provided].sort().join(", ")}.`
);
