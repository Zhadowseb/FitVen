import { normalizeScope, scopeKey } from "@utils/gymCategories";

// Every level above a centre - all countries, a country, a region - is this
// one screen with a different scope.
const LEVEL_ROUTE = "GymsPage";

/**
 * Up to a centre level. Back to it when it is already in the stack below this
 * screen, so back keeps meaning "one level up"; pushed when it is not - which
 * is how Centres, opened straight on a country, reaches all countries.
 *
 * navigate() cannot do either: with the same route name on top it only swaps
 * the params of the screen you are on.
 */
export function openScopeLevel(navigation, scope, params = {}) {
  const target = normalizeScope(scope);
  const key = scopeKey(target);
  const state = navigation?.getState?.();
  const routes = state?.routes ?? [];
  const current = typeof state?.index === "number" ? state.index : routes.length - 1;

  for (let index = current - 1; index >= 0; index -= 1) {
    const route = routes[index];

    if (route?.name === LEVEL_ROUTE && route.params?.scope && scopeKey(route.params.scope) === key) {
      navigation.pop(current - index);
      return;
    }
  }

  navigation.push(LEVEL_ROUTE, { ...params, scope: target });
}
