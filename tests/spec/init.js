describe("melonJS initialization", function () {
    me.sys.stopOnAudioError = false;

    me.boot();

    // Initialize video
    if (!me.video.init(1024, 768, {wrapper : "screen"})) {
        throw "me.video.init failed";
    }

    // Hide the screen
    var scr = document.querySelector("#screen");
    if (scr) {
        scr.style.display = "none";
    }
});
