/*
* main.js
* A Basic Tiled Loader
 */

var game = {

    /**
     * initlization
     */
    onload: function () {

        // init the video
        if (!me.video.init(320, 320, {wrapper: "jsapp", scale: me.device.PixelRatio})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // set all ressources to be loaded
        me.loader.onload = this.loaded.bind(this);
//debugger;

        // set all ressources to be loaded
        me.loader.preload(g_ressources);

        // load everything & display a loading screen
        me.state.change(me.state.LOADING);
    },

    /**
     * callback when everything is loaded
     */
    loaded: function () {
        // set the "Play/Ingame" Screen Object
        me.state.set(me.state.PLAY, new game.PlayScreen());

        // Set the Level
        me.levelDirector.loadLevel("training_64x64");

        // enable the keyboard (to navigate in the map)
        me.input.bindKey(me.input.KEY.LEFT,  "left");
        me.input.bindKey(me.input.KEY.RIGHT, "right");
        me.input.bindKey(me.input.KEY.UP,    "up");
        me.input.bindKey(me.input.KEY.DOWN,  "down");
        me.input.bindKey(me.input.KEY.ENTER, "enter");

        // start the game
        me.state.change(me.state.PLAY);
    }
}; // game

//call the game.onload() function
me.device.onReady(function() {
    game.onload();
});