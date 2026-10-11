// Knowledge: the articles themselves (every footnote has a source, English and
// Danish have the same shape, the zone rows cover every zone), and the rules of
// the pages - NEW and read, the categories that are offered, search, and the
// read state kept per person.
const assert = require("assert");
const loadAppModule = require("./lib/loadAppModule");

console.warn = () => {};
const storage = new Map();

loadAppModule.stubModule("@react-native-async-storage/async-storage", {
  __esModule: true,
  default: {
    getItem: async (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: async (key, value) => storage.set(key, String(value)),
    removeItem: async (key) => storage.delete(key),
  },
});

const { ARTICLES, getArticleById } = loadAppModule("src/Resources/Knowledge/index.js");
const rules = loadAppModule("src/Utils/knowledge.js");
const { STEP_ZONES } = loadAppModule("src/Utils/stepZones.js");
const service = loadAppModule("src/Services/knowledgeService.js");
const format = loadAppModule("src/Utils/knowledgeFormat.js");

/* ----------------------------------------------------------- the articles -- */

assert.deepStrictEqual(
  ARTICLES.map((article) => article.id).sort(),
  ["step-zones", "strength-counts-as-steps"],
  "only articles with a text are shipped: the two that have none yet are left out"
);
assert.strictEqual(new Set(ARTICLES.map((article) => article.id)).size, ARTICLES.length, "ids are unique");

for (const article of ARTICLES) {
  assert.match(article.date, /^\d{4}-\d{2}-\d{2}$/, `${article.id} has a date`);
  assert.ok(article.readMinutes > 0, `${article.id} has a reading time`);
  assert.ok(article.categories.length > 0 && article.categories.every((category) => rules.CATEGORY_ORDER.includes(category)));
  assert.ok(article.sources.length > 0, `${article.id} lists its sources`);
  assert.ok(article.sources.every((source) => source.title && source.byline));

  for (const related of article.related) {
    assert.ok(getArticleById(related), `${article.id} points at ${related}, which exists`);
    assert.notStrictEqual(related, article.id, "and not at itself");
  }

  const [en, da] = [article.content.en, article.content.da];

  assert.ok(en && da, `${article.id} has both languages`);
  assert.strictEqual(da.inShort.length, en.inShort.length, `${article.id}: the same number of bullets in Danish`);
  assert.strictEqual(da.sections.length, en.sections.length, `${article.id}: the same number of sections in Danish`);
  assert.deepStrictEqual(Object.keys(da.zoneNotes ?? {}), Object.keys(en.zoneNotes ?? {}), `${article.id}: the same zone notes`);

  for (const [language, content] of Object.entries(article.content)) {
    assert.ok(content.title && content.summary, `${article.id} (${language}) has a title and a summary`);
    assert.ok(content.inShort.length > 0, `${article.id} (${language}) has an "in short"`);

    content.sections.forEach((section, index) => {
      assert.ok(section.heading, `${article.id} (${language}) section ${index} has a heading`);
      assert.ok(section.paragraphs.length > 0);
      assert.strictEqual(
        section.paragraphs.length,
        en.sections[index].paragraphs.length,
        `${article.id} (${language}) section ${index} has the paragraphs the English one has`
      );
      assert.strictEqual(section.block, en.sections[index].block, "and the same block");

      for (const paragraph of section.paragraphs) {
        for (const part of paragraph) {
          if (typeof part === "string") {
            continue;
          }

          assert.ok(Array.isArray(part.ref) && part.ref.length > 0, "a footnote names its numbers");

          for (const number of part.ref) {
            assert.ok(number >= 1 && number <= article.sources.length, `${article.id}: footnote ${number} is one of its ${article.sources.length} sources`);
          }
        }
      }
    });
  }
}

// Every source is cited at least once, so none is listed that nothing rests on.
for (const article of ARTICLES) {
  const cited = new Set(
    article.content.en.sections.flatMap((section) =>
      section.paragraphs.flatMap((paragraph) => paragraph.flatMap((part) => (typeof part === "string" ? [] : part.ref)))
    )
  );

  assert.deepStrictEqual([...cited].sort(), article.sources.map((_, index) => index + 1), `${article.id}: every source is cited`);
}

{
  // The zone rows are drawn from stepZones.js; only the line under each is written here.
  const zones = getArticleById("step-zones");

  for (const language of ["en", "da"]) {
    assert.deepStrictEqual(
      Object.keys(zones.content[language].zoneNotes).sort(),
      STEP_ZONES.map((zone) => zone.id).sort(),
      `a note for every zone, in ${language}`
    );
    assert.ok(zones.content[language].sections.some((section) => section.block === "zones"));
    assert.ok(zones.content[language].sections.some((section) => section.block === "curve"));
  }
}

// The figures the articles state are the app's own.
{
  const counts = getArticleById("strength-counts-as-steps").content.en;
  const text = JSON.stringify(counts);

  assert.ok(/115 steps per minute/.test(text) && /3,450/.test(text), "the rate and its example are the ones in stepZones.js (115 a minute, 30 min = 3,450)");
}

/* ------------------------------------------------------------------ rules -- */

const en = (article) => rules.localizeArticle(article, "en");
const da = (article) => rules.localizeArticle(article, "da");
const zones = getArticleById("step-zones");
const counts = getArticleById("strength-counts-as-steps");

assert.strictEqual(en(counts).title, "Does strength training count as steps?");
assert.strictEqual(da(counts).title, "Tæller styrketræning som skridt?");
assert.strictEqual(rules.localizeArticle(counts, "de").title, en(counts).title, "a language with no text reads English");
assert.strictEqual(rules.localizeArticle(counts, "da").id, counts.id, "and keeps what is not text");
assert.strictEqual(rules.localizeArticle(null, "en"), null);

// Newest first; the same day keeps the listed order.
assert.deepStrictEqual(rules.sortArticles(ARTICLES).map((article) => article.id), ARTICLES.map((article) => article.id));
assert.deepStrictEqual(
  rules.sortArticles([{ id: "a", date: "2026-09-01" }, { id: "b", date: "2026-10-01" }, { id: "c", date: "2026-10-01" }]).map((article) => article.id),
  ["b", "c", "a"]
);
assert.strictEqual(rules.pickFeatured(ARTICLES).id, "strength-counts-as-steps", "the one marked featured is featured");
assert.strictEqual(rules.pickFeatured([{ id: "a", date: "2026-09-01" }, { id: "b", date: "2026-10-01" }]).id, "b", "and otherwise the newest");
assert.strictEqual(rules.pickFeatured([{ id: "a", date: "2026-10-01" }, { id: "b", date: "2026-09-01", featured: true }]).id, "b", "unless one is marked");
assert.strictEqual(rules.pickFeatured([]), null);

// NEW: within 14 days and not opened.
{
  const published = Date.parse("2026-10-10T00:00:00Z");
  const day = 24 * 60 * 60 * 1000;
  const none = new Set();

  assert.strictEqual(rules.isNewArticle(counts, none, published + 1 * day), true, "the day after");
  assert.strictEqual(rules.isNewArticle(counts, none, published + 14 * day), true, "on the fourteenth day");
  assert.strictEqual(rules.isNewArticle(counts, none, published + 14 * day + 1), false, "not after it");
  assert.strictEqual(rules.isNewArticle(counts, none, published - day), false, "not before it was published");
  assert.strictEqual(rules.isNewArticle(counts, new Set([counts.id]), published + day), false, "opened is not new");
  assert.strictEqual(rules.hasNewArticles(ARTICLES, none, published + day), true);
  assert.strictEqual(rules.hasNewArticles(ARTICLES, new Set(ARTICLES.map((article) => article.id)), published + day), false, "the badge goes when every one has been opened");
  assert.strictEqual(rules.hasNewArticles(ARTICLES, none, published + 90 * day), false, "and when they are all old");
}

// Categories: only those that have an article.
assert.deepStrictEqual(rules.categoriesWithArticles(ARTICLES), ["steps", "strength"], "Cardio and Recovery have no article and are not offered");
assert.deepStrictEqual(rules.categoriesWithArticles([]), []);

// Search over title and summary, locally.
{
  const articles = ARTICLES.map(en);

  assert.deepStrictEqual(rules.filterArticles(articles, {}).map((article) => article.id), ARTICLES.map((article) => article.id));
  assert.deepStrictEqual(rules.filterArticles(articles, { category: "strength" }).map((article) => article.id), ["strength-counts-as-steps"], "a category with the article in it");
  assert.deepStrictEqual(rules.filterArticles(articles, { category: "steps" }).map((article) => article.id).sort(), ["step-zones", "strength-counts-as-steps"], "steps & strength is filed under both");
  assert.deepStrictEqual(rules.filterArticles(articles, { query: "ZONES" }).map((article) => article.id), [], "the title says steps, not zones - and case does not matter");
  assert.deepStrictEqual(rules.filterArticles(articles, { query: "  really need " }).map((article) => article.id), ["step-zones"], "a title");
  assert.deepStrictEqual(rules.filterArticles(articles, { query: "walking can't" }).map((article) => article.id), ["strength-counts-as-steps"], "a summary");
  assert.deepStrictEqual(rules.filterArticles(articles, { query: "kettlebell" }), [], "a search with no hits is an empty list");
  assert.deepStrictEqual(rules.filterArticles(articles, { category: "strength", query: "really" }), [], "both together");
}

// How an article is filed.
assert.strictEqual(rules.categoryLabelKey(counts), "knowledge.categories.stepsStrength");
assert.strictEqual(rules.categoryLabelKey(zones), "knowledge.categories.steps");
assert.strictEqual(rules.categoryTone(counts), "strength", "steps & strength is told in the strength colour");
assert.strictEqual(rules.categoryTone(zones), "steps");

// Footnotes and dates.
assert.strictEqual(format.footnoteMarker([2]), "²");
assert.strictEqual(format.footnoteMarker([4, 5]), "⁴˒⁵");
assert.strictEqual(format.footnoteMarker([10]), "¹⁰");
assert.strictEqual(
  format.paragraphToPlainText(["Rate from the calculator.", { ref: [1] }, " Walks use real steps."], (numbers) => `source ${numbers.join(", ")}`),
  "Rate from the calculator. (source 1) Walks use real steps.",
  "a screen reader hears the source, not a raised digit"
);
assert.strictEqual(format.formatArticleDate("2026-10-10", "en-US"), "10 Oct 2026", "English is day first, as the design has it");
assert.strictEqual(format.formatArticleDate("2026-10-10", "da-DK"), "10. okt. 2026");

/* ----------------------------------------------------------------- service -- */

async function main() {
  assert.deepStrictEqual([...(await service.getReadArticleIds("u1"))], [], "nothing is read at first");

  const afterOne = await service.markArticleRead("u1", "step-zones");

  assert.deepStrictEqual([...afterOne], ["step-zones"]);
  assert.deepStrictEqual([...(await service.getReadArticleIds("u1"))], ["step-zones"], "and it is kept");

  await service.markArticleRead("u1", "step-zones");
  await service.markArticleRead("u1", "strength-counts-as-steps");
  assert.deepStrictEqual([...(await service.getReadArticleIds("u1"))].sort(), ["step-zones", "strength-counts-as-steps"], "opened twice is read once");

  assert.deepStrictEqual([...(await service.getReadArticleIds("u2"))], [], "another person's reading is their own");
  assert.deepStrictEqual([...(await service.getReadArticleIds(null))], [], "so is nobody's");

  storage.set("fitven.knowledge.read.u3", "not json");
  assert.deepStrictEqual([...(await service.getReadArticleIds("u3"))], [], "a damaged value is nothing read, not a crash");
  storage.set("fitven.knowledge.read.u4", JSON.stringify([1, "step-zones", null]));
  assert.deepStrictEqual([...(await service.getReadArticleIds("u4"))], ["step-zones"], "only ids count");
}

main()
  .then(() => {
    console.log("Knowledge: the articles (footnotes, sources, English and Danish), NEW and read, categories, search and the read state.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
