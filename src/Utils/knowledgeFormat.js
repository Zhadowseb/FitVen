// How a date is written on the Knowledge pages: "10 Oct 2026". English is
// written day first, as the design has it, whatever the phone's region is.

export function formatArticleDate(iso, locale = "en") {
  const [year, month, day] = String(iso).split("-").map(Number);
  const tag = String(locale).toLowerCase().startsWith("en") ? "en-GB" : locale;

  return new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

const SUPERSCRIPT_DIGITS = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

/** [4, 5] -> "⁴˒⁵": a footnote's numbers, raised, for text that has no superscript. */
export function footnoteMarker(numbers) {
  return numbers
    .map((number) =>
      String(number)
        .split("")
        .map((digit) => SUPERSCRIPT_DIGITS[Number(digit)] ?? digit)
        .join("")
    )
    .join("˒");
}

/**
 * A paragraph as one plain sentence for a screen reader, where each footnote is
 * read as "(source 2)" instead of a raised digit it would read as a number.
 * `sourceLabel(numbers)` words the footnote in the person's language.
 */
export function paragraphToPlainText(parts, sourceLabel) {
  return parts.map((part) => (typeof part === "string" ? part : ` (${sourceLabel(part.ref)})`)).join("").replace(/\s+/g, " ").trim();
}
