(function exposeCleanTouchMicroLayout(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.cleanTouchMicroLayout = api;
})(typeof globalThis === 'object' ? globalThis : this, function createMicroLayoutApi() {
  const MICRO_SIZE = 48;

  function createIconShape() {
    const inset = 3, width = 42, radius = 15;
    return Array.from({ length: width }, (_, row) => {
      const distance = Math.max(radius - row - 0.5, row + 0.5 - (width - radius), 0);
      const cut = distance ? Math.ceil(radius - Math.sqrt(radius * radius - distance * distance)) : 0;
      return { x: inset + cut, y: inset + row, width: width - cut * 2, height: 1 };
    });
  }

  function protectMicroWindowSize(window, initialPosition) {
    let correcting = false;
    window.setMinimumSize(MICRO_SIZE, MICRO_SIZE);
    window.setMaximumSize(MICRO_SIZE, MICRO_SIZE);
    const enforce = (position = window.getBounds()) => {
      if (correcting || window.isDestroyed()) return;
      correcting = true;
      try {
        if (window.isMaximized()) window.unmaximize();
        const bounds = window.getBounds();
        const wanted = { x: position.x, y: position.y, width: MICRO_SIZE, height: MICRO_SIZE };
        // Windows can add up to two DIP when converting a fixed-size window
        // to physical pixels at 125% scaling. Do not create a resize feedback loop.
        const validSize = bounds.width >= MICRO_SIZE && bounds.width <= MICRO_SIZE + 2
          && bounds.height >= MICRO_SIZE && bounds.height <= MICRO_SIZE + 2;
        if (!validSize || bounds.x !== wanted.x || bounds.y !== wanted.y) window.setBounds(wanted, false);
      } finally { correcting = false; }
    };
    window.on('resize', () => enforce());
    window.on('maximize', () => enforce());
    enforce(initialPosition);
    return enforce;
  }
  function copyPoint(point) {
    return { x: Number(point.x), y: Number(point.y) };
  }

  function createDragController(initialPosition) {
    let position = copyPoint(initialPosition);
    let active = null;
    let target = null;
    let ignoreGeneratedClick = false;

    return {
      begin(pointerId, pointerX, pointerY) {
        ignoreGeneratedClick = false;
        active = {
          pointerId,
          pointerX,
          pointerY,
          lastPointerX: pointerX,
          lastPointerY: pointerY,
          origin: copyPoint(position),
        };
        target = null;
      },
      move(pointerId, pointerX, pointerY) {
        if (!active || active.pointerId !== pointerId) return null;
        active.lastPointerX = pointerX;
        active.lastPointerY = pointerY;
        target = {
          x: active.origin.x + pointerX - active.pointerX,
          y: active.origin.y + pointerY - active.pointerY,
        };
        return copyPoint(target);
      },
      finish(pointerId, dragged = false) {
        if (!active || active.pointerId !== pointerId) return null;
        if (target) position = copyPoint(target);
        ignoreGeneratedClick = Boolean(dragged);
        active = null;
        target = null;
        return copyPoint(position);
      },
      consumeGeneratedClick() {
        if (!ignoreGeneratedClick) return false;
        ignoreGeneratedClick = false;
        return true;
      },
      setPosition(nextPosition) {
        if (!nextPosition || !Number.isFinite(nextPosition.x) || !Number.isFinite(nextPosition.y)) return copyPoint(position);
        position = copyPoint(nextPosition);
        // The native window can clamp a drag at a display edge. Rebase the
        // active drag there so reversing direction immediately moves the icon.
        if (active) {
          active.origin = copyPoint(position);
          active.pointerX = active.lastPointerX;
          active.pointerY = active.lastPointerY;
          target = null;
        }
        return copyPoint(position);
      },
      getPosition() {
        return copyPoint(position);
      },
    };
  }

  function expandAtAnchor(anchor, area, width, height) {
    const fittedWidth = Math.min(width, area.width);
    const fittedHeight = Math.min(height, area.height);
    const centerX = anchor.x + anchor.width / 2;
    const centerY = anchor.y + anchor.height / 2;
    return {
      x: Math.round(Math.max(area.x, Math.min(centerX - fittedWidth / 2, area.x + area.width - fittedWidth))),
      y: Math.round(Math.max(area.y, Math.min(centerY - fittedHeight / 2, area.y + area.height - fittedHeight))),
      width: fittedWidth,
      height: fittedHeight,
    };
  }

  function clampToWorkArea(position, size, area) {
    const fittedWidth = Math.min(size.width, area.width);
    const fittedHeight = Math.min(size.height, area.height);
    return {
      x: Math.round(Math.max(area.x, Math.min(position.x, area.x + area.width - fittedWidth))),
      y: Math.round(Math.max(area.y, Math.min(position.y, area.y + area.height - fittedHeight))),
    };
  }

  return { MICRO_SIZE, createIconShape, protectMicroWindowSize, createDragController, expandAtAnchor, clampToWorkArea };
});
