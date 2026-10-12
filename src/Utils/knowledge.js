// The rules of the Knowledge pages, without the screens: how an article is read
// in a language, which are new, which categories to offer and what a search
// finds. Pure: the articles and the read ids are handed in.

export const NEW_ARTICLE_DAYS = 14;
export const CATEGORY_ORDER = Object.freeze(["steps", "strength", "cardio", "recovery"]);

const DAY_MS = 24 * 60 * 60 * 1000;

/** The article with its text in the language, or in English where it has none. */
export function localizeArticle(article, language) {
  if (!article) {
    return null;
  }

  const content = article.content[language] ?? article.content.en;

  return { ...article, ...content };
}

/** Newest first; the same date keeps the order the articles were listed in. */
export function sortArticles(articles) {
  return articles
    .map((article, index) => ({ article, index }))
    .sort((left, right) => {
      if (left.article.date !== right.article.date) {
        return left.article.date < right.article.date ? 1 : -1;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.article);
}

/** A `featured` article, else the newest. */
export function pickFeatured(articles) {
  const sorted = sortArticles(articles);

  return sorted.find((article) => article.featured) ?? sorted[0] ?? null;
}

/**
 * New: published within the last 14 days and not opened yet. An old article
 * nobody has opened has no label at all, and an opened one is "read".
 */
export function isNewArticle(article, readIds, now = Date.now()) {
  if (readIds.has(article.id)) {
    return false;
  }

  const published = Date.parse(`${article.date}T00:00:00Z`);

  if (!Number.isFinite(published)) {
    return false;
  }

  return now - published <= NEW_ARTICLE_DAYS * DAY_MS && now >= published;
}

export function hasNewArticles(articles, readIds, now = Date.now()) {
  return articles.some((article) => isNewArticle(article, readIds, now));
}

/** Only the categories that have an article: an empty one is not offered. */
export function categoriesWithArticles(articles) {
  return CATEGORY_ORDER.filter((category) =>
    articles.some((article) => article.categories.includes(category))
  );
}

/** The articles of a category ("all" for every one), found by a search over title and summary. */
export function filterArticles(articles, { category = "all", query = "" } = {}) {
  const needle = query.trim().toLowerCase();

  return articles.filter((article) => {
    if (category !== "all" && !article.categories.includes(category)) {
      return false;
    }

    if (!needle) {
      return true;
    }

    return `${article.title} ${article.summary}`.toLowerCase().includes(needle);
  });
}

/** The key of the label an article is filed under: "Steps & strength" when it is both. */
export function categoryLabelKey(article) {
  if (article.categories.includes("steps") && article.categories.includes("strength")) {
    return "knowledge.categories.stepsStrength";
  }

  return `knowledge.categories.${article.categories[0]}`;
}

/** Which colour an article's category is told in: strength is orange, the rest green. */
export function categoryTone(article) {
  return article.categories.includes("strength") ? "strength" : "steps";
}
