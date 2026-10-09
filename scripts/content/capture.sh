#!/usr/bin/env bash
# Starter den byggede app i en koerende emulator, logger ind paa demokontoen og
# optager det. Koeres af .github/workflows/content-capture.yml, men virker mod
# enhver adb-enhed:
#
#   APK_PATH=app.apk OUT_DIR=out DEMO_EMAIL=... DEMO_PASSWORD=... bash scripts/content/capture.sh
#
# Uden DEMO_EMAIL og DEMO_PASSWORD naar den kun til login-skaermen, og optager
# den. Med dem logger den ind og tager et skaermbillede af hver fane.
#
# Det, der bliver uploadet (OUT_DIR), er videoer og billeder. Skaermdumps ligger
# i en midlertidig mappe, og loggen kommer kun med, hvis noget gik galt.
# Adgangskoden bliver hverken skrevet til loggen eller til en fil.

set -euo pipefail

PKG="com.anonymous.programapp"
APK_PATH="${APK_PATH:?APK_PATH is not set}"
OUT_DIR="${OUT_DIR:-out}"
WORK="$(mktemp -d)"
mkdir -p "$OUT_DIR"

# shellcheck source=scripts/content/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

step() { printf '\n== %s\n' "$*"; }

on_exit() {
  local status=$?

  if [ "$status" -ne 0 ]; then
    echo "Det gik galt (afslutningskode $status). Gemmer, hvad der er at se."
    adb exec-out screencap -p > "$OUT_DIR/fejl.png" 2>/dev/null || true
    if [ -f "$WORK/ui.xml" ]; then
      echo "Paa skaermen: $(node "$UI_JS" "$WORK/ui.xml" texts 2>/dev/null | tr '\n' '|' | cut -c1-600)"
    fi
    adb logcat -d 2>/dev/null | grep -vi "password" > "$OUT_DIR/logcat.txt" || true
  fi

  stop_recording
  rm -rf "$WORK"
}
trap on_exit EXIT

step "Installer"
adb install -r "$APK_PATH"

# Appen foelger systemets tema ("auto"), saa det er dem her, der goer den moerk.
adb shell cmd uimode night yes >/dev/null 2>&1 || true

step "Start appen"
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null

# Foerste start: JS-bundlen skal indlaeses, og sessionen gendannes. Venter paa
# at appen har tegnet noget, frem for et fast antal sekunder.
drawn=false
for i in $(seq 1 30); do
  sleep 2
  if dump_ui && grep -q "package=\"$PKG\"" "$WORK/ui.xml" \
     && [ "$(grep -o 'text="[^"]' "$WORK/ui.xml" | wc -l)" -gt 3 ]; then
    echo "App tegnet efter $((i * 2)) s"
    drawn=true
    break
  fi
done
$drawn || { echo "FEJL: appen tegnede ikke noget"; exit 1; }

adb exec-out screencap -p > "$OUT_DIR/01-start.png"

if [ -z "${DEMO_EMAIL:-}" ] || [ -z "${DEMO_PASSWORD:-}" ]; then
  step "Uden login"
  echo "DEMO_EMAIL og DEMO_PASSWORD er ikke sat: der optages kun login-skaermen."

  adb shell screenrecord --time-limit 8 /sdcard/start.mp4 &
  RECORD_PID=$!
  sleep 2
  adb shell input swipe 540 1600 540 800 400 || true
  sleep 1
  adb shell input swipe 540 800 540 1600 400 || true
  wait "$RECORD_PID" || true
  sleep 1
  adb pull /sdcard/start.mp4 "$OUT_DIR/start.mp4"
else
  step "Login"
  adb shell screenrecord --time-limit 170 /sdcard/login.mp4 &
  sleep 1

  tap_where 10 --class EditText --index 0 || { echo "FEJL: fandt ikke feltet til e-mail"; exit 1; }
  adb shell input text "$(escape "$DEMO_EMAIL")"
  tap_where 5 --class EditText --index 1 || { echo "FEJL: fandt ikke feltet til adgangskode"; exit 1; }
  adb shell input text "$(escape "$DEMO_PASSWORD")"
  # Tastaturet daekker knappen. BACK lukker det, naar det er aabent.
  adb shell input keyevent KEYCODE_BACK
  sleep 1
  # Overskriften og knappen siger begge "Login"; knappen er den nederste.
  tap_where 5 --text 'Login' --last || { echo "FEJL: fandt ikke Login-knappen"; exit 1; }

  # Til Home: det er den, der siger godmorgen. Undervejs kan Android spoerge om
  # lov til notifikationer, og det besvares.
  home='Good (morning|afternoon|evening|night),?'
  loggedIn=false
  for _ in $(seq 1 45); do
    if on_screen --text "$home"; then
      loggedIn=true
      break
    fi
    if on_screen --id 'permission_allow_button|permission_allow_foreground_only_button'; then
      tap_where 1 --id 'permission_allow_button|permission_allow_foreground_only_button' || true
    fi
    sleep 2
  done
  $loggedIn || { echo "FEJL: naaede ikke Home efter login"; exit 1; }
  echo "Logget ind"

  sleep 4
  stop_recording
  adb pull /sdcard/login.mp4 "$OUT_DIR/login.mp4"

  # Appen skal have faaet tegnet vennerne og feedet, foer der tages billeder.
  sleep 6
  adb exec-out screencap -p > "$OUT_DIR/02-home.png"

  for tab in "FEED:03-feed" "EXPLORE:04-explore" "TRAIN:05-train" "HOME:06-home-igen"; do
    label="${tab%%:*}"
    name="${tab##*:}"

    if tap_where 3 --text "$label" --last; then
      sleep 5
      adb exec-out screencap -p > "$OUT_DIR/$name.png"
    else
      echo "Sprang $label over: fandt ikke fanen"
    fi
  done
fi

step "Tjek"
# Appen skal stadig leve og ikke have crashet.
test -n "$(adb shell pidof "$PKG" | tr -d '\r')" || { echo "FEJL: appen koerer ikke"; exit 1; }
if adb logcat -d | grep -q "FATAL EXCEPTION"; then
  adb logcat -d | grep -A12 "FATAL EXCEPTION" | head -40
  echo "FEJL: appen crashede"
  exit 1
fi

for file in "$OUT_DIR"/*.png "$OUT_DIR"/*.mp4; do
  test "$(wc -c < "$file")" -gt 20000 || { echo "FEJL: $file er tom"; exit 1; }
done

step "Afslut"
ls -la "$OUT_DIR"
