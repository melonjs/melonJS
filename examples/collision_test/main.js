var game = {
    // game assets
    assets : [  
        { name: "alien",   type:"image", src:"data/gfx/alien.png" },
        { name: "flushed", type:"image", src:"data/gfx/flushed.png" },
        { name: "scream",  type:"image", src:"data/gfx/scream.png" },
        { name: "smile",   type:"image", src:"data/gfx/smile.png" },
        { name: "smirk",   type:"image", src:"data/gfx/smirk.png" },
        { name: "brick",   type:"image", src:"data/gfx/brick.png" }
    ],

    onload: function()
    {
        // init the video
        if (!me.video.init('screen', me.video.CANVAS, 1024, 768, true, 'auto')) {
            alert("Sorry but your browser does not support html 5 canvas. Please try with another one!");
            return;
        }

        // install the debug panel plugin
        me.plugin.register(debugPanel, "debug");
        me.debug.renderQuadTree = true;

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
         // clear the background
        me.game.world.addChild(new me.ColorLayer("background", "#5E3F66", 0), 0);
        
        // Add some objects
        for (var i = 0; i < 200; i++) {
            me.game.world.addChild(new Smilie(i), 3);
        }
    }
});

var Smilie = me.Entity.extend({
    init : function (i) {
        this._super(
            me.Entity,
            "init",
            [64 + Math.random() * (1024 - 64 * 2 - 16),
            64 + Math.random() * (768 - 64 * 2 - 16),
            {
                width : 16,
                height : 16,
            }]
        );
        
        // disable gravity and add a random velocity
        this.body.gravity = 0;
        this.body.vel.set(Number.prototype.random(-4, 4), Number.prototype.random(-4, 4));

        this.alwaysUpdate = true;
           
        // add the coin sprite as renderable
        this.renderable = new me.Sprite(0, 0, me.loader.getImage(game.assets[i % 5].name));
       
        // add a collision shape
        this.body.addShape(new me.Ellipse(4, 4, 8, 8));
    },

    update : function (dt) {
        this.pos.add(this.body.vel);
        
        // world limit check
        if( this.pos.x > 1024 ) this.pos.x = 0;
        if( this.pos.x < 0 ) this.pos.x = 1024;
        if( this.pos.y > 768 ) this.pos.y = 0;
        if( this.pos.y < 0 ) this.pos.y = 768;
        
        // update the body pos and bounds since
        // we manipulated the entity pos manually
        this.body.updateBounds();
                
        if (me.collision.check(this, true, this.collideHandler.bind(this), true)) {
            // me.collision.check returns true in case of collision
            this.renderable.setOpacity(1.0);
        } else {
            this.renderable.setOpacity(0.5);
        };
        return true;
    },

    // collision handler
    collideHandler : function (response) {
        // make them bounce when touching eachother
        this.pos.sub(response.overlapN);
        if (response.overlapN.x !== 0) {
            this.body.vel.x = -this.body.vel.x;
        }
        if (response.overlapN.y !== 0) {
            this.body.vel.y = -this.body.vel.y;
        }
    }
});
    
/* Bootstrap */
window.onReady(function onReady() {
    game.onload();
});
