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
        if (!me.video.init(800, 600, {wrapper : "screen", scale : 'auto'})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // add "#debug" to the URL to enable the debug Panel
        if (document.location.hash.match("debug")) {
            window.onReady(function () {
                me.plugin.register.defer(this, me.debug.Panel, "debug");
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
    },
    WORLD_WIDTH: 1024,
    WORLD_HEIHGT: 768
};
