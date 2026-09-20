import { useEffect, useRef, useState } from "react";

import { t } from "@localization";
import { gymService } from "../../Services";

// Two screens search the centre list: the Centres screen and the Change centre
// sheet. They had the same effect written out twice with the setters renamed,
// which meant a fix to the minimum length or a race here was invisible over
// there.
export const GYM_SEARCH_MIN_LENGTH = 2;
export const GYM_SEARCH_DEBOUNCE_MS = 250;

/**
 * Debounced centre search.
 *
 * `results` is null until a search has run - not an empty array, because the
 * two mean different things on screen: null is "showing the normal list" and
 * [] is "searched and found nothing".
 *
 * @param {string} query what the person has typed
 * @param {(message: string) => void} [onError] called with a message when the
 *   search fails; the screens put it in their own error state
 */
export function useGymSearch(query, onError) {
  const [results, setResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const timeoutRef = useRef(null);

  // Held in a ref so a screen passing an inline arrow - all of them do - does
  // not restart the debounce on every render.
  const onErrorRef = useRef(onError);

  onErrorRef.current = onError;

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const trimmed = query.trim();

    if (trimmed.length < GYM_SEARCH_MIN_LENGTH) {
      setResults(null);
      setIsSearching(false);
      return undefined;
    }

    setIsSearching(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        setResults(await gymService.searchGyms({ query: trimmed }));
      } catch (error) {
        setResults([]);
        onErrorRef.current?.(
          error instanceof Error ? error.message : t("gyms.searchFailed")
        );
      } finally {
        setIsSearching(false);
      }
    }, GYM_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutRef.current);
  }, [query]);

  return { results, isSearching };
}
