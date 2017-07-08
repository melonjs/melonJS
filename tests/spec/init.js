//melonJS initialization
beforeAll((done) => {
    console.log ('Initializing melonJS');
    me.sys.stopOnAudioError = false;

    me.boot();

    // Initialize video
    if (!me.video.init(1024, 768, {wrapper : "screen"})) {
        throw "me.video.init failed";
    }

    // Hide the screen
    let scr = document.querySelector("#screen");
    if (scr) {
        scr.style.display = "none";
    }
    done();
});
