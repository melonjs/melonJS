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
        if (!me.video.init(800, 480, {wrapper : "jsapp", scale : "auto", preferWebGL1: false, scaleMethod : "flex", useParentDOMSize : false})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // set all ressources to be loaded
        me.loader.preload(g_ressources, this.loaded.bind(this));
    },


    /**
     * callback when everything is loaded
     */
    loaded: function () {

        // enable the keyboard (to navigate in the map)
        me.input.bindKey(me.input.KEY.LEFT,  "left");
        me.input.bindKey(me.input.KEY.RIGHT, "right");
        me.input.bindKey(me.input.KEY.UP,    "up");
        me.input.bindKey(me.input.KEY.DOWN,  "down");
        me.input.bindKey(me.input.KEY.ENTER, "enter");
        // subscribe to key down event
        this.handle = me.event.subscribe(me.event.KEYDOWN, this.keyPressed.bind(this));

        me.input.registerPointerEvent("wheel", me.game.viewport, this.onScroll.bind(this));

        // load a level
        me.levelDirector.loadLevel("village");

        // force redraw
        me.game.repaint();
    },

    /**
     * pointermove function
     */
    onScroll: function (event) {
        if (event.deltaX !== 0) {
            this.keyPressed(event.deltaX < 0 ? "left" : "right");
        }
        if (event.deltaY !== 0) {
            this.keyPressed(event.deltaY < 0 ? "up" : "down");
        }
    },

    /**
     * update function
     */
    keyPressed: function (action /*, keyCode, edge */) {

        // navigate the map :)
        if (action === "left") {
            me.game.viewport.move(-(me.levelDirector.getCurrentLevel().tilewidth / 2), 0);
        } else if (action === "right") {
            me.game.viewport.move(me.levelDirector.getCurrentLevel().tilewidth / 2, 0);
        }

        if (action === "up") {
            me.game.viewport.move(0, -(me.levelDirector.getCurrentLevel().tileheight / 2));
        } else if (action === "down") {
            me.game.viewport.move(0, me.levelDirector.getCurrentLevel().tileheight / 2);
        }

        if (action === "enter") {
            me.game.viewport.shake(16, 500);
        }

        // force redraw
        me.game.repaint();
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
                level = "isometric";
                break;
            case "5":
                level = "perspective";
                break;
            default:
                return;
        };

        // load the new level
        me.levelDirector.loadLevel(level);

        // force redraw
        me.game.repaint();
    }

};
