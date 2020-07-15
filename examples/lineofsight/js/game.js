
/* Game namespace */
var game = {
    // Run on page load.
    "onload" : function () {
        // Initialize the video.
        if (!me.video.init(800, 600, {parent : "screen", scale : "auto", renderer : me.video.CANVAS})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

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

        // render hitbox int the debug panel
        me.debug.renderHitBox = true;

        // switch to PLAY state
        me.state.change(me.state.PLAY);
    }
};
