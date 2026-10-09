// The content capture's helpers: finding things on an Android screen from a
// uiautomator dump, and the rules the shell script keeps about the demo
// password. Nothing here starts an emulator; the CI run does that.

const assert = require("assert");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ui = require("./content/ui");

const root = path.join(__dirname, "..");
const UI_JS = path.join(__dirname, "content", "ui.js");

// A login screen as uiautomator dumps it: a heading and a button that both say
// "Login", two fields, a password field showing dots, and a node with nothing in it.
const LOGIN_SCREEN = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.anonymous.programapp" content-desc="" clickable="false" password="false" bounds="[0,0][1080,2400]">
    <node index="0" text="Login" resource-id="" class="android.widget.TextView" content-desc="" clickable="false" password="false" bounds="[58,500][320,640]" />
    <node index="1" text="you@example.com" resource-id="" class="android.widget.EditText" content-desc="" clickable="true" password="false" bounds="[108,1000][972,1130]" />
    <node index="2" text="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;" resource-id="" class="android.widget.EditText" content-desc="" clickable="true" password="true" bounds="[108,1200][830,1330]" />
    <node index="3" text="" resource-id="" class="android.view.ViewGroup" content-desc="" clickable="true" password="false" bounds="[58,1420][1022,1570]" />
    <node index="4" text="Login" resource-id="" class="android.widget.TextView" content-desc="" clickable="false" password="false" bounds="[400,1450][680,1540]" />
    <node index="5" text="Forgot password?" resource-id="" class="android.widget.TextView" content-desc="" clickable="true" password="false" bounds="[390,1600][690,1660]" />
    <node index="6" text="Tom &amp; Jerry" resource-id="" class="android.widget.TextView" content-desc="" clickable="false" password="false" bounds="[0,0][0,0]" />
    <node index="7" text="Allow" resource-id="com.android.permissioncontroller:id/permission_allow_button" class="android.widget.Button" content-desc="" clickable="true" password="false" bounds="[100,2000][980,2140]" />
  </node>
</hierarchy>`;

const nodes = ui.parseNodes(LOGIN_SCREEN);

assert.strictEqual(nodes.length, 9, "every node with bounds is read");
assert.deepStrictEqual(nodes[1].box, [58, 500, 320, 640]);

const point = (...args) => {
  const found = ui.select(nodes, ui.parseSelector(args));

  return found ? ui.center(found) : null;
};

// The fields are found by class and order, so no hint text has to be known.
assert.deepStrictEqual(point("--class", "EditText", "--index", "0"), { x: 540, y: 1065 }, "the email field");
assert.deepStrictEqual(point("--class", "EditText", "--index", "1"), { x: 469, y: 1265 }, "the password field");
assert.strictEqual(point("--class", "EditText", "--index", "2"), null, "there is no third field");

// The heading and the button both say Login; the button is the lower one.
assert.deepStrictEqual(point("--text", "Login"), { x: 189, y: 570 }, "the first is the heading");
assert.deepStrictEqual(point("--text", "Login", "--last"), { x: 540, y: 1495 }, "--last is the button");
assert.strictEqual(point("--text", "Log"), null, "a text has to match whole: Log is not Login");
assert.deepStrictEqual(point("--text", "login"), { x: 189, y: 570 }, "case does not matter");
assert.deepStrictEqual(point("--text", "Forgot password\\?"), { x: 540, y: 1630 });

// A resource id is matched by a part, a text by the whole, and a node with no size is not there.
assert.deepStrictEqual(point("--id", "permission_allow_button"), { x: 540, y: 2070 });
assert.strictEqual(point("--text", "Tom & Jerry"), null, "a node with no size cannot be tapped");
assert.ok(nodes.some((node) => node.text === "Tom & Jerry"), "but entities are decoded");
assert.strictEqual(point("--class", "ViewGroup", "--clickable", "--text", "Login"), null, "every selector has to hold");
assert.deepStrictEqual(point("--class", "ViewGroup", "--clickable"), { x: 540, y: 1495 });

// Texts for the log never include what is in a password field.
const texts = ui.visibleTexts(nodes);

assert.ok(texts.includes("you@example.com") && texts.includes("Login"));
assert.ok(!texts.some((text) => text.includes("•")), "a password field's text is not printed");

// A slow emulator makes Android ask whether to close the launcher; the dialog covers the app and is all a dump sees.
const ANR = ui.parseNodes(`<hierarchy>
  <node text="Pixel Launcher isn't responding" class="android.widget.TextView" clickable="false" password="false" bounds="[60,1160][1020,1260]" />
  <node text="Close app" class="android.widget.TextView" clickable="false" password="false" bounds="[260,1330][700,1400]" />
  <node text="Wait" class="android.widget.TextView" clickable="false" password="false" bounds="[260,1440][400,1500]" />
</hierarchy>`);

assert.ok(ui.select(ANR, ui.parseSelector(["--text", ".*isn't responding.*"])), "the dialog is recognised");
assert.deepStrictEqual(ui.center(ui.select(ANR, ui.parseSelector(["--text", "Wait"]))), { x: 330, y: 1470 }, "Wait, not Close app, is what is tapped");
assert.ok(!ui.select(ui.parseNodes(LOGIN_SCREEN), ui.parseSelector(["--text", ".*isn't responding.*"])), "an ordinary screen is not mistaken for it");

// As a command: the exit code says whether something matched.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fitven-ui-"));

try {
  const dump = path.join(tmp, "ui.xml");

  fs.writeFileSync(dump, LOGIN_SCREEN);

  const run = (...args) => spawnSync(process.execPath, [UI_JS, dump, ...args], { encoding: "utf8" });

  assert.strictEqual(run("point", "--text", "Login", "--last").stdout.trim(), "540 1495");
  assert.strictEqual(run("has", "--text", "Login").status, 0);
  assert.strictEqual(run("has", "--text", "Good (morning|afternoon)").status, 1, "Home is not on screen");
  assert.strictEqual(run("point", "--text", "Nothing").status, 1);
  assert.ok(!run("texts").stdout.includes("•"), "the command prints no password dots either");

  // --- The shell script's rules about the password ----------------------------
  const lib = fs.readFileSync(path.join(__dirname, "content", "lib.sh"), "utf8");
  const capture = fs.readFileSync(path.join(__dirname, "content", "capture.sh"), "utf8");

  for (const [name, source] of [["lib.sh", lib], ["capture.sh", capture]]) {
    assert.ok(!/^\s*set\s+-[a-z]*x/m.test(source), `${name} does not trace its commands, which would print what is typed`);
    assert.ok(!/(echo|printf|cat)[^\n]*\$\{?DEMO_PASSWORD/.test(source.replace(/^\s*#.*$/gm, "")), `${name} never prints the password`);
  }
  assert.ok(!/>\s*[^\n]*\$\{?DEMO_PASSWORD/.test(capture.replace(/^\s*#.*$/gm, "")), "and never writes it to a file");
  assert.ok(/adb shell input text "\$\(escape "\$DEMO_PASSWORD"\)"/.test(capture), "it is typed through escape()");
  assert.ok(/isn't responding/.test(lib) && /tap_dialog_button 'Wait'/.test(lib), "a not-responding dialog is answered with Wait");
  assert.ok(!/keeps stopping/.test(lib), "but the app's own crash dialog is not dismissed: that is a failure to be seen");

  // escape() makes a text safe to send through adb's shell. Skipped where there is no bash.
  const bash = spawnSync("bash", ["-c", "true"]);

  if (bash.status === 0) {
    const escaped = spawnSync("bash", ["-c", 'source "$1"; escape "a b&c;d(e)\'f" ', "_", path.join(__dirname, "content", "lib.sh")], {
      encoding: "utf8",
    });

    assert.strictEqual(escaped.stdout, "a\\ b\\&c\\;d\\(e\\)\\'f", "every character the device's shell reads is escaped");
    assert.strictEqual(
      spawnSync("bash", ["-c", 'source "$1"; escape "Plain@name_1.x-y"', "_", path.join(__dirname, "content", "lib.sh")], { encoding: "utf8" }).stdout,
      "Plain@name_1.x-y",
      "what is safe is left alone"
    );
    assert.strictEqual(spawnSync("bash", ["-n", path.join(__dirname, "content", "capture.sh")]).status, 0, "capture.sh parses");
    assert.strictEqual(spawnSync("bash", ["-n", path.join(__dirname, "content", "lib.sh")]).status, 0, "lib.sh parses");
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// --- The workflow -------------------------------------------------------------
const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "content-capture.yml"), "utf8");
const uses = [...workflow.matchAll(/\$\{\{\s*secrets\.([A-Z_]+)\s*\}\}/g)].map((match) => match[1]).sort();

assert.deepStrictEqual(uses, ["DEMO_EMAIL", "DEMO_PASSWORD"], "the only secrets the capture reads are the demo account's");
assert.ok(
  workflow.indexOf("secrets.DEMO_PASSWORD") > workflow.indexOf("name: Emulator\n        uses:"),
  "and only the emulator step gets them"
);
assert.ok(/hashFiles\('src\/\*\*'/.test(workflow), "the APK cache is keyed on the app's source");
assert.ok(/cache-hit != 'true'/.test(workflow), "a cache hit skips the build");

console.log(
  "Content capture: a screen dump is read into taps (fields by order, the lower of two Logins, no hint text), a password field is never printed, the shell script never echoes or writes the password and types it through escape(), and the workflow gives only the emulator step the demo secrets."
);
