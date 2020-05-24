var game = {
    // game assets
    assets : [
        { name: "alien",   type:"image", src:"data/img/alien.png" },
        { name: "flushed", type:"image", src:"data/img/flushed.png" },
        { name: "scream",  type:"image", src:"data/img/scream.png" },
        { name: "smile",   type:"image", src:"data/img/smile.png" },
        { name: "smirk",   type:"image", src:"data/img/smirk.png" },
        { name: "brick",   type:"image", src:"data/img/brick.png" }
    ],

    onload: function()
    {
        // Initialize the video.
        if (!me.video.init(1024, 768, {scaleMethod : "flex"})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // set all resources to be loaded
        me.loader.preload(game.assets, this.loaded.bind(this), false);
    },

    loaded: function () {

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

        // add a background layer
        me.game.world.addChild(new me.ColorLayer("background", "#5E3F66", 0), 0);

        // Add some objects
        for (var i = 0; i < 255; i++) {
            me.game.world.addChild(new Smilie(i), 3);
        }


    }
};


var Smilie = me.Entity.extend({
    init : function (i) {
        this._super(
            me.Entity,
            "init",
            [
                me.Math.random(-15, me.game.viewport.width),
                me.Math.random(-15, me.game.viewport.height),
                {
                    width : 16,
                    height : 16,
                    shapes : [ new me.Ellipse(6, 6, 10, 10) ]
                }
            ]
        );

        // disable gravity and add a random velocity
        this.body.gravity = 0;
        this.body.vel.set(me.Math.randomFloat(-4, 4), me.Math.randomFloat(-4, 4));

        this.alwaysUpdate = true;

        // add the coin sprite as renderable
        this.renderable = new me.Sprite(0, 0, {image: me.loader.getImage(game.assets[i % 5].name)});
        this.renderable.anchorPoint.set(0.5, 0.5);
    },

    update : function () {
        this.pos.add(this.body.vel);

        // world limit check
        if (this.pos.x >= me.game.viewport.width) {
            this.pos.x = -15;
        }
        if (this.pos.x < -15) {
            this.pos.x = me.game.viewport.width - 1;
        }
        if (this.pos.y >= me.game.viewport.height) {
            this.pos.y = -15;
        }
        if (this.pos.y < -15) {
            this.pos.y = me.game.viewport.height - 1;
        }

        // rotate the sprite based on the current velocity
        this.renderable.rotate(this.body.vel.x < 0 ? -0.05 : 0.05);

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
            this.body.vel.x = me.Math.randomFloat(-4, 4) * -Math.sign(this.body.vel.x);
        }
        if (response.overlapN.y !== 0) {
            this.body.vel.y = me.Math.randomFloat(-4, 4) * -Math.sign(this.body.vel.y);
        }

        return false;
    }
});
