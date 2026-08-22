// WebAudio autoplay-policy gesture bridge.
//
// Browser-only policy boundary. Android's OpenAL/Oboe device starts
// synchronously, while a browser is allowed to create its AudioContext only
// in the suspended state. Emscripten's autoResumeAudioContext uses one-shot
// listeners tied to the context that existed when it was called. Keep the
// Android sound object/data flow unchanged, but retain a capture listener so
// later contexts and a rejected first attempt can use the next real gesture.
//
// Shared by every suspension backend (Asyncify / JSPI): main.cpp calls
// krkr2_install_web_audio_resume() unconditionally before OpenAL init.
addToLibrary({
  krkr2_install_web_audio_resume__deps: ['$AL'],
  krkr2_install_web_audio_resume: () => {
    if (globalThis.__krkr2WebAudioResumeInstalled) return;
    globalThis.__krkr2WebAudioResumeInstalled = true;

    var resumeCurrentOpenALContext = (event) => {
      if (!event.isTrusted) return;
      var audioContext = AL.currentCtx?.audioCtx;
      if (!audioContext || audioContext.state !== 'suspended') return;
      var promise = audioContext.resume();
      if (promise) promise.catch(() => {});
    };

    for (var event of
         ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click']) {
      document.addEventListener(event, resumeCurrentOpenALContext, {
        capture: true,
        passive: true,
      });
    }
  },
});
