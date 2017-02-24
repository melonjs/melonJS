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
        // Initialize the video.
        if (!me.video.init(1024, 768, {wrapper : "screen", scale : "auto"})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // set all resources to be loaded
        me.loader.preload(game.assets, this.loaded.bind(this));
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
            [
                (-15).random(1024),
                (-15).random(768),
                {
                    width : 16,
                    height : 16,
                    shapes : [ new me.Ellipse(4, 4, 8, 8) ]
                }
            ]
        );

        // disable gravity and add a random velocity
        this.body.gravity = 0;
        this.body.vel.set((-4).randomFloat(4), (-4).randomFloat(4));

        this.alwaysUpdate = true;

        // add the coin sprite as renderable
        this.renderable = new me.Sprite(0, 0, {image: me.loader.getImage(game.assets[i % 5].name)});
    },

    update : function () {
        this.pos.add(this.body.vel);

        // world limit check
        if (this.pos.x >= 1024) {
            this.pos.x = -15;
        }
        if (this.pos.x < -15) {
            this.pos.x = 1024 - 1;
        }
        if (this.pos.y >= 768) {
            this.pos.y = -15;
        }
        if (this.pos.y < -15) {
            this.pos.y = 768 - 1;
        }

        if (me.collision.check(this)) {
            // me.collision.check returns true in case of collision
            this.renderable.setOpacity(1.0);
        }
        else {
            this.renderable.setOpacity(0.5);
        }
        return true;
    },

    // collision handler
    onCollision : function (response) {

        this.pos.sub(response.overlapN);
        if (response.overlapN.x !== 0) {
            this.body.vel.x = (-4).randomFloat(4) * -Math.sign(this.body.vel.x);
        }
        if (response.overlapN.y !== 0) {
            this.body.vel.y = (-4).randomFloat(4) * -Math.sign(this.body.vel.y);
        }

        return false;
    }
});

/* Bootstrap */
window.onReady(function onReady() {
    game.onload();
});
