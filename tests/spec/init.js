/*
 melonJS initialization

 It is important for this block to be executed before any manipulation with graphics-related objects is happening,
 hence make sure to put all code that depends on object pool, inside 'it' or 'before' blocks for their respective
 'describe' blocks, e. g.:

   describe("Shape : me.Font", function () {
     var font;
     before(function () {
       font = new me.Font("Arial", 8, "white");
     });

 */
import * as me from "melonjs";
import mock from "mock-browser";

before(function (done) {
    //    var MockBrowser = require("mock-browser").mocks.MockBrowser;
    const mockBrowser = new mock.mocks.MockBrowser();
    Object.assign(global, mockBrowser);
    console.log("Initializing melonJS");

    me.boot();

    // Initialize video
    if (!me.video.init(1024, 768, { parent: "screen" })) {
        throw "me.video.init failed";
    }

    // Hide the screen
    var scr = document.querySelector("#screen");
    if (scr) {
        scr.style.display = "none";
    }
    done();
});
