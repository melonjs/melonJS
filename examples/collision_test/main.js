var game = {

    onload: function()
    {
        // Initialize the video.
        if (!me.video.init(1024, 768, {scaleMethod : "flex"})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // load our monster image and populate the game world
        me.loader.load({ name: "monster", type:"image", src:"data/img/monster.png" }, function () {
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
        });
    }
};

var Smilie = me.Sprite.extend({
    init : function (i) {
        this._super(me.Sprite, "init", [
            me.Math.random(-15, me.game.viewport.width),
            me.Math.random(-15, me.game.viewport.height),
            {
                image: "monster.png"
            }
        ]);

        // only supported by the WebGL renderer
        this.tint = new me.Color().random(64, 255);

        // add a physic body with an ellipse as body shape
        this.body = new me.Body(this, new me.Ellipse(6, 6, this.width - 6, this.height - 6));
        this.body.vel.set(me.Math.randomFloat(-4, 4), me.Math.randomFloat(-4, 4));
        this.body.gravityScale = 0;
    },

    update : function () {
        this.pos.add(this.body.vel);

        // world limit check
        if (this.pos.x > me.game.viewport.width) {
            this.body.vel.x = me.Math.randomFloat(-4, 4) * -Math.sign(this.body.vel.x);
        }
        if (this.pos.x < 0) {
            this.body.vel.x = me.Math.randomFloat(-4, 4) * -Math.sign(this.body.vel.x);
        }
        if (this.pos.y > me.game.viewport.height) {
            this.body.vel.y = me.Math.randomFloat(-4, 4) * -Math.sign(this.body.vel.y);
        }
        if (this.pos.y < 0) {
            this.body.vel.y = me.Math.randomFloat(-4, 4) * -Math.sign(this.body.vel.y);
        }

        // rotate the sprite based on the current velocity
        this.rotate(this.body.vel.x < 0 ? -0.05 : 0.05);

        if (me.collision.check(this)) {
            // me.collision.check returns true in case of collision
            this.setOpacity(1.0);
        }
        else {
            this.setOpacity(0.5);
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
