import stepZones from "./stepZones";
import strengthCountsAsSteps from "./strengthCountsAsSteps";

// The articles Knowledge shows, bundled in the app: one module each, with its
// English and Danish text. Two more were planned in the design ("Why the first
// 4,000 steps matter most" and "Strength training: how little is enough?") and
// are left out until their text exists - nothing here is empty, and nothing says
// "coming soon".
//
// Moving them to Supabase later is a separate decision; it changes how NEW is
// worked out, not the shape of an article.
export const ARTICLES = [stepZones, strengthCountsAsSteps];

export function getArticleById(id) {
  return ARTICLES.find((article) => article.id === id) ?? null;
}
