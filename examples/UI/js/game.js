
/* Game namespace */
var game = {
    // Run on page load.
    "onload" : function () {
        // Initialize the video.
        if (!me.video.init(800, 600, {parent : "screen", scale : "auto", scaleMethod : "flex-width", renderer : me.video.CANVAS})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // set all ressources to be loaded
        me.loader.preload(game.resources, this.loaded.bind(this));
    },


    /**
     * callback when everything is loaded
     */
    loaded: function () {


        // load the texture atlas file
        // this will be used by object entities later
        game.texture = new me.video.renderer.Texture([
            me.loader.getJSON("UI_Assets-0"),
            me.loader.getJSON("UI_Assets-1"),
            me.loader.getJSON("UI_Assets-2")
        ]);

        // set the "Play/Ingame" Screen Object
        me.state.set(me.state.PLAY, new game.PlayScreen());

        // add some keyboard shortcuts
        me.event.subscribe(me.event.KEYDOWN, function (action, keyCode /*, edge */) {

            // toggle fullscreen on/off
            if (keyCode === me.input.KEY.F) {
                if (!me.device.isFullscreen) {
                    me.device.requestFullscreen();
                } else {
                    me.device.exitFullscreen();
                }
            }
        });

        // switch to PLAY state
        me.state.change(me.state.PLAY);
    }
};
