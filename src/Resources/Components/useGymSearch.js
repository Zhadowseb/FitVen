import { useEffect, useRef, useState } from "react";

import { t } from "@localization";
import { gymService } from "@services";

// Two screens search the centre list: the Centres screen and the Change centre
// sheet. They had the same effect written out twice with the setters renamed,
// which meant a fix to the minimum length or a race here was invisible over
// there.
export const GYM_SEARCH_MIN_LENGTH = 2;
export const GYM_SEARCH_DEBOUNCE_MS = 250;

const searchEveryCentre = (query) => gymService.searchGyms({ query });

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
 * @param {object} [options]
 * @param {(query: string) => Promise<object[]>} [options.search] what to
 *   search with; every centre by default. The Centres screen searches inside
 *   the level it shows.
 * @param {string} [options.searchKey] changes when `search` starts looking
 *   somewhere else, so the search runs again
 */
export function useGymSearch(query, onError, { search = searchEveryCentre, searchKey = "" } = {}) {
  const [results, setResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const timeoutRef = useRef(null);

  // The debounce cancels a search that has not started; it cannot cancel one
  // already in flight. Typing "puregym" then "puregym aarhus" leaves two
  // requests out, and the slower one wins whenever it answers last - the list
  // goes back to the wrong results with the field untouched. Every search
  // takes a number, and only the newest may write.
  const requestRef = useRef(0);

  // Held in a ref so a screen passing an inline arrow - all of them do - does
  // not restart the debounce on every render.
  const onErrorRef = useRef(onError);
  const searchRef = useRef(search);

  onErrorRef.current = onError;
  searchRef.current = search;

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const trimmed = query.trim();

    if (trimmed.length < GYM_SEARCH_MIN_LENGTH) {
      requestRef.current += 1;
      setResults(null);
      setIsSearching(false);
      return undefined;
    }

    setIsSearching(true);
    timeoutRef.current = setTimeout(async () => {
      requestRef.current += 1;

      const request = requestRef.current;

      try {
        const found = await searchRef.current(trimmed);

        if (request === requestRef.current) {
          setResults(found);
        }
      } catch (error) {
        if (request === requestRef.current) {
          setResults([]);
          onErrorRef.current?.(
            error instanceof Error ? error.message : t("gyms.searchFailed")
          );
        }
      } finally {
        if (request === requestRef.current) {
          setIsSearching(false);
        }
      }
    }, GYM_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutRef.current);
  }, [query, searchKey]);

  return { results, isSearching };
}
