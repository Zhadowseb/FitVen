#!/usr/bin/env bash
# Starter den byggede app i en koerende emulator og tager skaermbilleder og en
# kort skaermoptagelse. Koeres af .github/workflows/content-capture.yml, men
# virker mod enhver adb-enhed: APK_PATH=app.apk OUT_DIR=out bash scripts/content/capture.sh
#
# Lige nu naar den kun til login-skaermen, fordi der ingen demokonto er.
# Alt, der skal tilfoejes, er flere trin mellem "start" og "afslut" nedenfor.

set -euo pipefail

PKG="com.anonymous.programapp"
APK_PATH="${APK_PATH:?APK_PATH is not set}"
OUT_DIR="${OUT_DIR:-out}"
mkdir -p "$OUT_DIR"

step() { printf '\n== %s\n' "$*"; }

step "Installer"
adb install -r "$APK_PATH"

step "Start appen"
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null

# Foerste start: JS-bundlen skal indlaeses, og sessionen gendannes. Venter paa
# at appen har tegnet noget, frem for et fast antal sekunder.
for i in $(seq 1 30); do
  sleep 2
  if adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; then
    adb pull /sdcard/ui.xml "$OUT_DIR/ui-start.xml" >/dev/null 2>&1 || true
    if grep -q 'package="'"$PKG"'"' "$OUT_DIR/ui-start.xml" 2>/dev/null \
       && [ "$(grep -o 'text="[^"]' "$OUT_DIR/ui-start.xml" | wc -l)" -gt 3 ]; then
      echo "App tegnet efter $((i * 2)) s"
      break
    fi
  fi
done

step "Skaermbillede og optagelse"
adb exec-out screencap -p > "$OUT_DIR/01-start.png"

# En optagelse er med for at vise, at den virker her: 8 sekunder, mens et
# tryk og et swipe sker.
adb shell screenrecord --time-limit 8 /sdcard/start.mp4 &
RECORD_PID=$!
sleep 2
adb shell input swipe 540 1600 540 800 400 || true
sleep 1
adb shell input swipe 540 800 540 1600 400 || true
wait "$RECORD_PID" || true
sleep 1
adb pull /sdcard/start.mp4 "$OUT_DIR/start.mp4"

adb logcat -d > "$OUT_DIR/logcat.txt" || true

step "Tjek"
# Appen skal stadig leve, have tegnet noget og ikke have crashet.
test -n "$(adb shell pidof "$PKG" | tr -d '\r')" || { echo "FEJL: appen koerer ikke"; exit 1; }
if grep -q "FATAL EXCEPTION" "$OUT_DIR/logcat.txt"; then
  grep -A12 "FATAL EXCEPTION" "$OUT_DIR/logcat.txt" | head -40
  echo "FEJL: appen crashede"
  exit 1
fi
test "$(wc -c < "$OUT_DIR/01-start.png")" -gt 20000 || { echo "FEJL: skaermbilledet er tomt"; exit 1; }
test "$(wc -c < "$OUT_DIR/start.mp4")" -gt 20000 || { echo "FEJL: optagelsen er tom"; exit 1; }

step "Afslut"
ls -la "$OUT_DIR"
