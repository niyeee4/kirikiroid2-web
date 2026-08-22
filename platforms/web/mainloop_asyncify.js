// Frame-pump override for the Asyncify (universal compatibility) build.
// Covers emscripten's built-in emscripten_set_main_loop_arg.
//
// Difference from mainloop_jspi_fix.js: the JSPI build must wrap the main
// loop tick with WebAssembly.promising so suspending imports can switch
// stacks (and JSC needs the unconditional wrap because its table.get does
// not return export-identical function objects). The Asyncify build has no
// stack-switching at all: a suspension unwinds through the instrumented
// wasm frame, the call simply returns early, and Asyncify schedules the
// rewind when the awaited Promise settles. Calling the raw table entry is
// exactly what stock emscripten does; wrapping it in promising() would be
// wrong here because this module contains no Suspending imports.
//
// Browser-only frame-pump policy. Keep RAF as the sole scheduler, but use
// its display-synchronised timestamp to limit how often the WASM main loop
// runs. The target defaults to 15 FPS and can be overridden with
// `?fps=<positive number>`; invalid values deliberately fall back to 15.
addToLibrary({
  emscripten_set_main_loop_arg__deps: ['$setMainLoop'],
  emscripten_set_main_loop_arg: (func, arg, fps, simulateInfiniteLoop) => {
    var wrappedTick = wasmTable.get(func);
    var targetFps = 15;
    try {
      var requestedFps = Number(
          new URLSearchParams(globalThis.location?.search || '').get('fps'));
      if (Number.isFinite(requestedFps) && requestedFps > 0) {
        targetFps = requestedFps;
      }
    } catch (e) {}
    var frameInterval = 1000 / targetFps;
    var lastRafTimestamp = -1;
    var accumulatedTime = 0;

    // TVPWebFrameTickUpdate consumes the same timestamp for its main-thread
    // clock phase lock. Install the wrapper before setMainLoop schedules its
    // first RAF so both the limiter and the engine observe the actual RAF
    // timestamp starting with the first callback.
    if (!globalThis.__tvpRafWrapped) {
      globalThis.__tvpRafWrapped = 1;
      globalThis.__tvpRafT = -1;
      var requestRaf = globalThis.requestAnimationFrame.bind(globalThis);
      globalThis.requestAnimationFrame = (callback) => requestRaf((timestamp) => {
        globalThis.__tvpRafT = timestamp;
        callback(timestamp);
      });
    }

    var iterFunc = () => {
      var timestamp = globalThis.__tvpRafT;
      if (!(timestamp >= 0)) timestamp = performance.now();

      if (lastRafTimestamp < 0) {
        lastRafTimestamp = timestamp;
        return wrappedTick(arg);
      }

      var elapsed = timestamp - lastRafTimestamp;
      lastRafTimestamp = timestamp;
      if (!(elapsed >= 0) || elapsed > 1000) {
        // Do not replay frames accumulated while the tab was suspended.
        accumulatedTime = 0;
        return wrappedTick(arg);
      }

      accumulatedTime += elapsed;
      if (accumulatedTime + 0.001 < frameInterval) return;

      // Consume one due frame, preserve its fractional remainder for stable
      // non-divisor rates such as 45 FPS on a 60 Hz display, and discard any
      // additional whole frames accumulated during a stall.
      accumulatedTime = Math.max(0, accumulatedTime - frameInterval);
      accumulatedTime %= frameInterval;
      return wrappedTick(arg);
    };
    setMainLoop(iterFunc, fps, simulateInfiniteLoop, arg);
  },
});
