
/* Game namespace */
var game = {
    // Run on page load.
    onload: function () {
        // Initialize the video.
        if (!me.video.init(480, 320, {wrapper : "screen", scale : "auto"})) {
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

        // Load the resources.
        me.loader.preload(game.resources, this.loaded.bind(this));
    },



    // Run on game resources loaded.
    loaded : function () {
        me.state.set(me.state.PLAY, new game.PlayScreen());

        // Start the game.
        me.state.change(me.state.PLAY);
    }
};
