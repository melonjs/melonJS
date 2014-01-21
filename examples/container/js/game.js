/**
 * main
 */
var game = {
    /**
     *
     * Initialize the application
     */
    onload: function() {
        // init the video
        if (!me.video.init('screen', 800, 600, true, 'auto')) {
            alert("Sorry but your browser does not support HTML5 canvas. Please try with another one!");
            return;
        }

        // add "#debug" to the URL to enable the debug Panel
        if (document.location.hash === "#debug") {
            window.onReady(function () {
                me.plugin.register.defer(this, debugPanel, "debug");
            });
        }

        // initialize the "sound engine"
        me.audio.init("mp3,ogg");

        // set all ressources to be loaded
        me.loader.onload = this.loaded.bind(this);

        // set all ressources to be loaded
        me.loader.preload(game.resources);

        // load everything & display a loading screen
        me.state.change(me.state.LOADING);
    },

    /**
     * callback when everything is loaded
     */
    loaded: function () {
        // set the "Play/Ingame" Screen Object
        me.state.set(me.state.PLAY, new game.PlayScreen());

        // switch to PLAY state
        me.state.change(me.state.PLAY);
    }
};
