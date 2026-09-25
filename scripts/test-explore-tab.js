// The Explore tab's wiring: the tab opens Explore, every screen Explore and
// its search and Social pages navigate to is a registered route, and all of
// them keep the Explore tab lit while you are on them.
//
// None of this fails loudly in the app. A navigate() to a name the stack does
// not know does nothing but warn in development, and a route missing from the
// tab's set lights Home instead - both only show up by tapping through.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const app = read("App.js");
const registered = new Set([...app.matchAll(/<Stack\.Screen\s+name="([A-Za-z]+)"/g)].map((match) => match[1]));

const nav = read("src/Resources/ThemedComponents/ThemedBottomNavigation.js");
const exploreBlock = nav.match(/const EXPLORE_ROUTES = new Set\(\[([\s\S]*?)\]\);/);
assert.ok(exploreBlock, "ThemedBottomNavigation no longer has an EXPLORE_ROUTES set");
const exploreRoutes = new Set([...exploreBlock[1].matchAll(/"([A-Za-z]+)"/g)].map((match) => match[1]));

assert.ok(nav.includes('goToTab("ExplorePage")'), "the Explore tab does not open ExplorePage");
assert.ok(nav.includes('t("nav.tabs.explore")'), "the tab is not labelled with nav.tabs.explore");
assert.ok(!/SearchPage"/.test(nav.replace(/ExploreSearchPage/g, "")), "the bottom navigation still names the old SearchPage");

for (const route of exploreRoutes) {
  assert.ok(registered.has(route), `EXPLORE_ROUTES names ${route}, which App.js does not register`);
}

const pages = [
  "src/Pages/ExplorePage/ExplorePage.js",
  "src/Pages/ExploreSearchPage/ExploreSearchPage.js",
  "src/Pages/SocialPage/SocialPage.js",
];
// Reached from Explore but belonging to a tab of their own.
const OTHER_TABS = new Set(["ProfilePage"]);

for (const page of pages) {
  const source = read(page);
  const targets = [...source.matchAll(/navigation\.(?:navigate|push)\(\s*"([A-Za-z]+)"/g)].map((match) => match[1]);

  for (const target of targets) {
    assert.ok(registered.has(target), `${page} navigates to ${target}, which App.js does not register`);
    assert.ok(
      exploreRoutes.has(target) || OTHER_TABS.has(target),
      `${page} navigates to ${target}, which is not in EXPLORE_ROUTES - the tab would switch to Home there`
    );
  }
}

for (const route of ["ExplorePage", "ExploreSearchPage", "SocialPage"]) {
  assert.ok(exploreRoutes.has(route), `${route} is not under the Explore tab`);
}

// Nothing links to the page that was renamed.
const sourceFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(rel);
    } else if (entry.name.endsWith(".js")) {
      sourceFiles.push(rel);
    }
  }
})("src");

for (const file of [...sourceFiles, "App.js"]) {
  assert.ok(
    !/navigate\(\s*"SearchPage"/.test(read(file)),
    `${file} still navigates to SearchPage, which is SocialPage now`
  );
}

console.log("Explore tab: the tab, its routes, and every link from Explore, its search and Social passed.");
