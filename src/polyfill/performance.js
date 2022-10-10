if ("performance" in globalThis === false) {
    globalThis.performance = {};
}

Date.now = (Date.now || function () {  // thanks IE8
    return new Date().getTime();
});

if ("now" in globalThis.performance === false) {

    let nowOffset = Date.now();

    if (performance.timing && performance.timing.navigationStart) {
      nowOffset = performance.timing.navigationStart;
    }

    globalThis.performance.now = function now() {
      return Date.now() - nowOffset;
  };
}
