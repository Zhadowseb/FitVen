// Back to Home the way the tab bar goes there: the Home already on the stack
// is handed back with its key, so it stays mounted with what it last drew
// instead of being built again from nothing (see goToTab in
// ThemedBottomNavigation). Without a Home on the stack, plain navigation.
export function goHome(navigation) {
  const routes = navigation?.getState?.()?.routes ?? [];
  const home = routes.find((route) => route.name === "HomePage");

  if (home) {
    navigation.reset({ index: 0, routes: [home] });
    return;
  }

  navigation?.navigate?.("HomePage");
}
