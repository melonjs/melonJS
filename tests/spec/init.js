/*
 melonJS initialization

 It is important for this block to be executed before any manipulation with graphics-related objects is happening,
 hence make sure to put all code that depends on object pool, inside 'it' or 'beforeAll' blocks for their respective
 'describe' blocks, e. g.:

   describe("Shape : me.Font", function () {
     var font;
     beforeAll(function () {
       font = new me.Font("Arial", 8, "white");
     });

 */

beforeAll(function (done) {
    console.log("Initializing melonJS");
    me.sys.stopOnAudioError = false;

    me.boot();

    // Initialize video
    if (!me.video.init(1024, 768, {parent: "screen"})) {
        throw "me.video.init failed";
    }

    // Hide the screen
    var scr = document.querySelector("#screen");
    if (scr) {
        scr.style.display = "none";
    }
    done();
});
