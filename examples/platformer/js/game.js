/**
 * main
 */
var game = {

    /**
     * object where to store game global data
     */
    data : {
        // score
        score : 0
    },

    /**
     *
     * Initialize the application
     */
    onload: function() {

        // init the video
        if (!me.video.init(800, 600, {wrapper : "screen", scale : "auto", scaleMethod : "flex-width", renderer : me.video.AUTO, subPixel : false })) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // initialize the "sound engine"
        me.audio.init("mp3,ogg");

        // set all ressources to be loaded
        me.loader.preload(game.resources, this.loaded.bind(this));
    },


    /**
     * callback when everything is loaded
     */
    loaded: function ()    {

        // set the "Play/Ingame" Screen Object
        me.state.set(me.state.PLAY, new game.PlayScreen());

        // set the fade transition effect
        me.state.transition("fade","#FFFFFF", 250);

        // register our objects entity in the object pool
        me.pool.register("mainPlayer", game.PlayerEntity);
        me.pool.register("SlimeEntity", game.SlimeEnemyEntity);
        me.pool.register("FlyEntity", game.FlyEnemyEntity);
        me.pool.register("CoinEntity", game.CoinEntity);

        // load the texture atlas file
        // this will be used by object entities later
        game.texture = new me.video.renderer.Texture(
            me.loader.getJSON("texture"),
            me.loader.getImage("texture")
        );

        // add some keyboard shortcuts
        me.event.subscribe(me.event.KEYDOWN, function (action, keyCode /*, edge */) {

            // change global volume setting
            if (keyCode === me.input.KEY.PLUS) {
                // increase volume
                me.audio.setVolume(me.audio.getVolume()+0.1);
            } else if (keyCode === me.input.KEY.MINUS) {
                // decrease volume
                me.audio.setVolume(me.audio.getVolume()-0.1);
            }

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
