/**
 *
 * a basic Tiled loader
 */

var game = {

    /**
     * initlization
     */
    onload: function() {

        // init the video
        if (!me.video.init(800, 480, {wrapper : "jsapp", scale : me.device.getPixelRatio()})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // set all ressources to be loaded
        me.loader.onload = this.loaded.bind(this);

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

        // enable the keyboard (to navigate in the map)
        me.input.bindKey(me.input.KEY.LEFT,  "left");
        me.input.bindKey(me.input.KEY.RIGHT, "right");
        me.input.bindKey(me.input.KEY.UP,    "up");
        me.input.bindKey(me.input.KEY.DOWN,  "down");
        me.input.bindKey(me.input.KEY.ENTER, "enter");

        // start the game
        me.state.change(me.state.PLAY);
    },



    /**
     *
     * change the current level
     * using the listbox current value in the HTML file
     */
    changelevel: function() {

        var level = "";
        var level_id = document.getElementById("level_name").value;

        switch (level_id) {
            case "1":
                level = "village";
                break;
            case "2":
                level = "desert";
                break;
            case "3":
                level = "sewers";
                break;
            case "4":
                level = "cute";
                break;
            case "5":
                level = "isometric";
                break;
            case "6":
                level = "perspective";
                break;
            default:
                return;
        };

        // load the new level
        me.levelDirector.loadLevel(level);
    }

}; // game


//bootstrap :)
window.onReady(function() {
    game.onload();
});
