
/* Game namespace */
var game = {
    // Run on page load.
    "onload" : function () {
        // Initialize the video.
        if (!me.video.init(1024, 768, {wrapper : "screen", scale : "auto"})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // add "#debug" to the URL to enable the debug Panel
        if (me.game.HASH.debug === true) {
            window.onReady(function () {
                me.plugin.register.defer(this, me.debug.Panel, "debug");
            });
        }

        // Initialize the audio.
        me.audio.init("mp3,ogg");

        // switch to the Play Screen.
        me.state.set(me.state.PLAY, new game.PlayScreen());
        me.state.change(me.state.PLAY);
    }
};
