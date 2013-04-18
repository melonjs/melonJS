var game = {
    // game assets
    assets : [  
        { name: "alien",   type:"image", src:"data/gfx/alien.png" },
        { name: "flushed", type:"image", src:"data/gfx/flushed.png" },
        { name: "scream",  type:"image", src:"data/gfx/scream.png" },
        { name: "smile",   type:"image", src:"data/gfx/smile.png" },
        { name: "smirk",   type:"image", src:"data/gfx/smirk.png" },
        { name: "brick",   type:"image", src:"data/gfx/brick.png" },
        { name: "level",   type:"tmx",   src:"data/map/level.tmx" }
    ],

    onload: function()
    {
        // init the video
        if (!me.video.init('screen', 1024, 768, true, 'auto')) {
            alert("Sorry but your browser does not support html 5 canvas. Please try with another one!");
            return;
        }
        // disable interpolation when scaling
        me.video.setImageSmoothing(false);

        // Run fast!
        me.sys.useNativeAnimFrame = true;

        // install the debug panel plugin
        me.plugin.register(debugPanel, "debug");
        me.debug.renderCollisionMap = true;
        me.debug.renderCollisionGrid = true;

        // set all resources to be loaded
        me.loader.onload = this.loaded.bind(this);

        // set all resources to be loaded
        me.loader.preload(game.assets);

        // load everything & display a loading screen
        me.state.change(me.state.LOADING);
    },

    loaded: function () {
        // set the "Play/Ingame" Screen Object
        me.state.set(me.state.PLAY, new PlayScreen());

        // switch to PLAY state
        me.state.change(me.state.PLAY);
    }
};

var PlayScreen = me.ScreenObject.extend( {
    onResetEvent: function() {
        me.levelDirector.loadLevel("level");

        // Add some objects
        for (var i = 0; i < 200; i++) {
            me.game.add(new Smilie(i), 2);
        }
    }
});

var Smilie = me.ObjectEntity.extend({
    init : function (i) {
        this.parent(
            64 + Math.random() * (1024 - 64 * 2 - 16),
            64 + Math.random() * (768 - 64 * 2 - 16), {
                spritewidth : 16,
                spriteheight : 16,
                image : game.assets[i % 5].name
            }
        );
        this.collidable = true;
    },

    update : function () {
        this.updateMovement();
        
        if (me.game.collide)
            me.game.collide(this, true);

        return this.parent();
    }
});
    
/* Bootstrap */
window.onReady(function onReady() {
    game.onload();
});
