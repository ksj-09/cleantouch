const test = require('node:test');
const assert = require('node:assert/strict');
const { createDragController, expandAtAnchor, clampToWorkArea } = require('../micro-widget-layout.cjs');

test('micro icon starts each drag from its latest committed position', () => {
  const drag = createDragController({ x: 100, y: 200 });

  drag.begin(1, 10, 10);
  assert.deepEqual(drag.move(1, 35, 28), { x: 125, y: 218 });
  assert.deepEqual(drag.finish(1), { x: 125, y: 218 });

  drag.begin(2, 50, 50);
  assert.deepEqual(drag.move(2, 62, 44), { x: 137, y: 212 });
  assert.deepEqual(drag.finish(2), { x: 137, y: 212 });
});

test('micro icon uses the display-clamped position for the next drag', () => {
  const drag = createDragController({ x: 100, y: 200 });
  drag.begin(1, 10, 10);
  drag.move(1, 500, 400);
  drag.finish(1);
  drag.setPosition({ x: 430, y: 370 });

  drag.begin(2, 0, 0);
  assert.deepEqual(drag.move(2, 5, 8), { x: 435, y: 378 });
});

test('micro icon can move away from a display edge without dragging back across the hidden pointer gap', () => {
  const drag = createDragController({ x: 1800, y: 400 });
  drag.begin(1, 10, 10);
  assert.deepEqual(drag.move(1, 210, 10), { x: 2000, y: 400 });
  const edgePosition = clampToWorkArea(
    { x: 2000, y: 400 },
    { width: 50, height: 50 },
    { x: 0, y: 0, width: 1920, height: 1040 },
  );
  drag.setPosition(edgePosition);

  assert.deepEqual(edgePosition, { x: 1870, y: 400 });
  assert.deepEqual(drag.move(1, 205, 10), { x: 1865, y: 400 });
});

test('micro icon crosses to an adjacent display when the pointer crosses its boundary', () => {
  const drag = createDragController({ x: 1870, y: 400 });
  drag.begin(1, 1890, 420);
  const nextDisplayTarget = drag.move(1, 1925, 420);
  const nextDisplayPosition = clampToWorkArea(
    nextDisplayTarget,
    { width: 50, height: 50 },
    { x: 1920, y: 0, width: 1600, height: 1040 },
  );
  drag.setPosition(nextDisplayPosition);

  assert.deepEqual(nextDisplayPosition, { x: 1920, y: 400 });
  assert.deepEqual(drag.move(1, 1932, 420), { x: 1927, y: 400 });
});

test('a drag consumes its generated click without opening the widget', () => {
  const drag = createDragController({ x: 100, y: 200 });
  drag.begin(1, 10, 10);
  drag.move(1, 30, 30);
  drag.finish(1, true);

  assert.equal(drag.consumeGeneratedClick(), true);
  assert.equal(drag.consumeGeneratedClick(), false);
});

test('a new press clears suppression if a drag generated no click event', () => {
  const drag = createDragController({ x: 100, y: 200 });
  drag.begin(1, 10, 10);
  drag.move(1, 30, 30);
  drag.finish(1, true);

  drag.begin(2, 40, 40);
  assert.equal(drag.consumeGeneratedClick(), false);
});

test('restored widget stays around the micro icon on displays with nonzero origins', () => {
  const bounds = expandAtAnchor(
    { x: 2100, y: 900, width: 50, height: 50 },
    { x: 1920, y: 0, width: 1600, height: 1040 },
    400,
    580,
  );

  assert.deepEqual(bounds, { x: 1925, y: 460, width: 400, height: 580 });
  assert.ok(bounds.x >= 1920 && bounds.x + bounds.width <= 3520);
  assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 1040);
});

test('restored widget remains within the work area when icon sits near its edge', () => {
  const bounds = expandAtAnchor(
    { x: 1870, y: 990, width: 50, height: 50 },
    { x: 0, y: 0, width: 1920, height: 1040 },
    400,
    580,
  );

  assert.deepEqual(bounds, { x: 1520, y: 460, width: 400, height: 580 });
});

test('micro icon can reach the full usable edge of a work area', () => {
  assert.deepEqual(
    clampToWorkArea(
      { x: 4000, y: 4000 },
      { width: 50, height: 50 },
      { x: 0, y: 0, width: 1920, height: 1040 },
    ),
    { x: 1870, y: 990 },
  );
});
