// Where the crown goes so it sits on the avatar rather than floating near it:
// tilted, with both bottom corners resting exactly on the ring.
//
// The crown is a box turned about its own centre. Each bottom corner, once
// turned, has to land on the ring - a circle - so the box's position must lie
// on a circle for each corner: the ring's circle moved back by that corner's
// offset. Two circles of the same radius meet in two points; the upper one
// puts the crown on top of the head.

const round = (value) => Math.round(value * 100) / 100;

/**
 * The top-left position of the crown's box, in the avatar's coordinates.
 *
 *   box         { width, height } of the crown's drawing
 *   corners     the two bottom corners, [[x, y], [x, y]], in the box
 *   angleDeg    the tilt, as React Native's rotate takes it (clockwise on
 *               screen for a positive angle), about the box's centre
 *   ringCentre  [x, y] of the avatar's ring
 *   ringRadius  the ring's radius, to the middle of its stroke
 */
export function placeCrownOnRing({ box, corners, angleDeg, ringCentre, ringRadius }) {
  const pivot = [box.width / 2, box.height / 2];
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const turned = corners.map(([x, y]) => {
    const dx = x - pivot[0];
    const dy = y - pivot[1];

    return [pivot[0] + dx * cos - dy * sin, pivot[1] + dx * sin + dy * cos];
  });
  const first = [ringCentre[0] - turned[0][0], ringCentre[1] - turned[0][1]];
  const second = [ringCentre[0] - turned[1][0], ringCentre[1] - turned[1][1]];
  const middle = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
  const dx = second[0] - first[0];
  const dy = second[1] - first[1];
  const distance = Math.hypot(dx, dy) || 1;
  const reach = Math.sqrt(Math.max(0, ringRadius ** 2 - (distance / 2) ** 2));
  const across = [-dy / distance, dx / distance];
  const options = [
    [middle[0] + across[0] * reach, middle[1] + across[1] * reach],
    [middle[0] - across[0] * reach, middle[1] - across[1] * reach],
  ];
  const [left, top] = options[0][1] < options[1][1] ? options[0] : options[1];

  return { left: round(left), top: round(top) };
}
