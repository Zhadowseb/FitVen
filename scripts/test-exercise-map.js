const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

async function run() {
  const root = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'src/Pages/ExerciseMapPage/exerciseMapUtils.js'), 'utf8');
  const { REGION_LABELS } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const atlas = JSON.parse(fs.readFileSync(path.join(root, 'src/Pages/ExerciseMapPage/bodyData.json'), 'utf8'));
  // Every region the figure can draw has to have a name, or a muscle the user
  // taps is one the rest of the app cannot say anything about.
  for (const side of Object.values(atlas)) for (const key of Object.keys(side.regions)) assert.ok(REGION_LABELS[key]);
  assert.equal(atlas.back.regions.upper_traps[0].id, 'trapezius_full_back');
  const touchSource = fs.readFileSync(path.join(root, 'src/Pages/ExerciseMapPage/exerciseMapTouch.js'), 'utf8');
  const { createMuscleTouchHandlers } = await import(`data:text/javascript;base64,${Buffer.from(touchSource).toString('base64')}`);
  let taps = 0;
  const touch = createMuscleTouchHandlers(() => taps++);
  const event = (x, y, fingers = 1) => ({ nativeEvent: { pageX: x, pageY: y, touches: Array(fingers).fill({}) } });
  touch.onResponderGrant(event(200, 500));
  touch.onResponderMove(event(201, 502));
  touch.onResponderRelease(event(201, 502, 0));
  assert.equal(taps, 1, 'A normal finger tap with small movement selects once');
  touch.onResponderGrant(event(200, 500));
  touch.onResponderMove(event(200, 520));
  touch.onResponderMove(event(200, 500));
  touch.onResponderRelease(event(200, 500, 0));
  assert.equal(taps, 1, 'Dragging away and returning must not select');
  touch.onResponderGrant(event(200, 500));
  assert.equal(touch.onResponderTerminationRequest(), true);
  touch.onResponderTerminate();
  touch.onResponderRelease(event(200, 500, 0));
  assert.equal(taps, 1, 'Scrolling cancels the pending selection');
  touch.onResponderGrant(event(200, 500));
  touch.onResponderMove(event(200, 500, 2));
  touch.onResponderRelease(event(200, 500, 0));
  assert.equal(taps, 1, 'Multiple fingers must not select');
  console.log('Exercise Map touch: finger movement, drag cancellation, scroll handoff and multitouch passed.');
  console.log('Exercise Map: every drawable region is named, and the back trapezius is the full group.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
