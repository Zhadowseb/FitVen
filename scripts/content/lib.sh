#!/usr/bin/env bash
# Hjaelpere til capture.sh: find noget paa skaermen, tryk, skriv. Kraever adb og
# node, og at WORK er en mappe, hvor skaermdump kan ligge - den kommer ikke med
# i det, der bliver uploadet.
#
# Intet her skriver en adgangskode til loggen. Der er hverken `set -x` eller en
# echo af det, der bliver skrevet; escape() faar den som argument og printer
# kun resultatet til adb.

UI_JS="$(dirname "${BASH_SOURCE[0]}")/ui.js"

# Goer en tekst sikker at sende gennem `adb shell input text`: alt andet end
# bogstaver, tal og @ . _ - faar en backslash foran, saa enhedens shell ikke
# fortolker det.
escape() {
  printf '%s' "$1" | sed -e 's/[^A-Za-z0-9@._-]/\\&/g'
}

# Henter skaermens struktur til $WORK/ui.xml. Falder en dump over (appen taegner
# et oejeblik), er det bare et forsoeg mere.
dump_ui() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 \
    && adb pull /sdcard/ui.xml "$WORK/ui.xml" >/dev/null 2>&1
}

# Er der noget paa skaermen, der matcher? Samme vaelgere som ui.js.
on_screen() {
  dump_ui && node "$UI_JS" "$WORK/ui.xml" has "$@"
}

# Trykker paa midten af det foerste, der matcher, og venter op til $1 forsoeg
# paa, at det dukker op (to sekunder imellem).
tap_where() {
  local tries=$1
  shift
  local point

  for _ in $(seq 1 "$tries"); do
    if dump_ui && point=$(node "$UI_JS" "$WORK/ui.xml" point "$@"); then
      # shellcheck disable=SC2086
      adb shell input tap $point
      return 0
    fi
    sleep 2
  done

  return 1
}

# Venter op til $1 forsoeg paa, at noget matcher.
wait_for() {
  local tries=$1
  shift

  for _ in $(seq 1 "$tries"); do
    if on_screen "$@"; then
      return 0
    fi
    sleep 2
  done

  return 1
}

# Stopper en skaermoptagelse, saa filen bliver faerdigskrevet (SIGINT) og hentet.
stop_recording() {
  adb shell pkill -2 screenrecord >/dev/null 2>&1 || true
  sleep 3
}
