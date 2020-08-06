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
        if (!me.video.init(1024, 786, {parent : "screen", scaleMethod : "flex-height", renderer : me.video.CANVAS})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // initialize the "sound engine"
        me.audio.init("mp3");

        // set all ressources to be loaded
        me.loader.preload(g_ressources, this.loaded.bind(this));
    },


    /**
     * callback when everything is loaded
     */
    loaded: function () {

        // subscribe to key down and mouse scroll event to move the map
        me.event.subscribe(me.event.KEYDOWN, this.keyPressed.bind(this));
        me.input.registerPointerEvent("wheel", me.game.viewport, this.onScroll.bind(this));

        // load default level
        this.levelSelector();
    },

    onLevelLoaded: function() {

        // add a black background
        me.game.world.addChild(new me.ColorLayer("background", "#000000"), 0);

        /* -- debug purpose
        // display the current pointer coordinates on top of the pointer arrow
        me.game.world.addChild(new (me.Renderable.extend({
            init: function() {
                this._super(me.Renderable, 'init', [0, 0, 10, 10]);
                this.font = new me.Text(0, 0, {font: "Arial", size: 10, fillStyle: "#FFFFFF", text : "?,?"});
                this.font.textAlign = "center";
                this.font.textBaseline = "bottom";
            },

            onActivateEvent: function () {
                // register on mouse event
                me.input.registerPointerEvent("pointermove", me.game.viewport, this.pointerMove.bind(this), false);
            },

            onDeactivateEvent: function () {
                // register on mouse event
                me.input.releasePointerEvent("pointermove", me.game.viewport);
            },


            pointerMove : function (e) {
                //var layer = me.game.world.getChildByName("Ground")[0];
                var layer = me.game.world.getChildByType(me.TMXLayer)[0];
                if (layer) {
                    var tile = layer.getTile(e.gameWorldX, e.gameWorldY);
                    if (tile) {
                        this.text = tile.col + "," + tile.row;
                        return;
                    }
                }
                this.text = "?,?";
            },

            update: function (dt) {
                return true;
            },

            draw: function(renderer) {
                var x = Math.round(me.input.pointer.gameLocalX);
                var y = Math.round(me.input.pointer.gameLocalY);
                this.font.draw(renderer, this.text, x, y );
            }
        })), 10);
        */


        // force redraw
        me.game.repaint();

    },

    /**
     * pointermove function
     */
    onScroll: function (event) {
        if (event.deltaX !== 0) {
            this.keyPressed(null, event.deltaX < 0 ? me.input.KEY.LEFT : me.input.KEY.RIGHT);
        }
        if (event.deltaY !== 0) {
            this.keyPressed(null, event.deltaY < 0 ? me.input.KEY.UP: me.input.KEY.DOWN);
        }
    },

    /**
     * update function
     */
    keyPressed: function (action, keyCode) {

        // navigate the map :)
        if (keyCode === me.input.KEY.LEFT) {
            me.game.viewport.move(-(me.levelDirector.getCurrentLevel().tilewidth / 2), 0);
        }
        if (keyCode === me.input.KEY.RIGHT) {
            me.game.viewport.move(me.levelDirector.getCurrentLevel().tilewidth / 2, 0);
        }
        if (keyCode === me.input.KEY.UP) {
            me.game.viewport.move(0, -(me.levelDirector.getCurrentLevel().tileheight / 2));
        }
        if (keyCode === me.input.KEY.DOWN) {
            me.game.viewport.move(0, me.levelDirector.getCurrentLevel().tileheight / 2);
        }

        // shake it
        if (keyCode === me.input.KEY.ENTER) {
            me.game.viewport.shake(16, 500);
        }

        //zoom in/out
        if (keyCode === me.input.KEY.MINUS) {
            console.log("zoom out");
        }
        if (keyCode === me.input.KEY.PLUS) {
            console.log("zoom in");
        }

        // force redraw
        me.game.repaint();
    },



    /**
     *
     * change the current level
     * using the listbox current value in the HTML file
     */
    levelSelector: function() {

        var level;

        switch (document.getElementById("level_name").value || 1) {
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
                level = "orthogonal";
                break;
            case "6":
                level = "perspective";
                break;
            case "7":
                level = "hexagonal-mini";
                break;
            case "8":
                level = "rpg";
                break;
            case "9":
                level = "MagicLand";
                break;
            case "10":
                level = "jb-32";
                break;
            case "11":
                level = "gameart2d-desert";
                break;
            case "12":
                level = "level25";
                break;
            case "13":
                level = "island-rotated-tiles";
                break;
            default:
                level = "village";
                break;
        };

        // load the new level
        me.levelDirector.loadLevel(level, {
            "container" : me.game.world,
            "onLoaded"  : this.onLevelLoaded.bind(this)
        });
    }

};
