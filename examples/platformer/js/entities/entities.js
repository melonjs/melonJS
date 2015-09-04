/************************************************************************************/
/*                                                                                  */
/*        a player entity                                                           */
/*                                                                                  */
/************************************************************************************/
game.PlayerEntity = me.Entity.extend({
    init: function(x, y, settings) {
        // call the constructor
        this._super(me.Entity, "init", [x, y , settings]);

        // player can exit the viewport (jumping, falling into a hole, etc.)
        this.alwaysUpdate = true;

        // walking & jumping speed
        this.body.setVelocity(3, 15);
        this.body.setFriction(0.4,0);

        this.dying = false;

        this.mutipleJump = 1;

        // set the display around our position
        me.game.viewport.follow(this, me.game.viewport.AXIS.BOTH);

        // enable keyboard
        me.input.bindKey(me.input.KEY.LEFT,  "left");
        me.input.bindKey(me.input.KEY.RIGHT, "right");
        me.input.bindKey(me.input.KEY.X,     "jump", true);
        me.input.bindKey(me.input.KEY.UP,    "jump", true);
        me.input.bindKey(me.input.KEY.DOWN,  "down");

        me.input.bindKey(me.input.KEY.A,     "left");
        me.input.bindKey(me.input.KEY.D,     "right");
        me.input.bindKey(me.input.KEY.W,     "jump", true);
        me.input.bindKey(me.input.KEY.S,     "down");

        me.input.bindGamepad(0, me.input.GAMEPAD.BUTTONS.FACE_1, me.input.KEY.UP);
        me.input.bindGamepad(0, me.input.GAMEPAD.BUTTONS.FACE_2, me.input.KEY.UP);
        me.input.bindGamepad(0, me.input.GAMEPAD.BUTTONS.DOWN, me.input.KEY.DOWN);
        me.input.bindGamepad(0, me.input.GAMEPAD.BUTTONS.FACE_3, me.input.KEY.DOWN);
        me.input.bindGamepad(0, me.input.GAMEPAD.BUTTONS.FACE_4, me.input.KEY.DOWN);
        me.input.bindGamepad(0, me.input.GAMEPAD.BUTTONS.LEFT, me.input.KEY.LEFT);
        me.input.bindGamepad(0, me.input.GAMEPAD.BUTTONS.RIGHT, me.input.KEY.RIGHT);

        // set a renderable
        this.renderable = game.texture.createAnimationFromName([
            "walk0001.png", "walk0002.png", "walk0003.png",
            "walk0004.png", "walk0005.png", "walk0006.png",
            "walk0007.png", "walk0008.png", "walk0009.png",
            "walk0010.png", "walk0011.png"
        ]);

        // define a basic walking animatin
        this.renderable.addAnimation ("walk",  [{ name: "walk0001.png", delay: 100 }, { name: "walk0002.png", delay: 100 }, { name: "walk0003.png", delay: 100 }]);
        // set as default
        this.renderable.setCurrentAnimation("walk");

        // set the renderable position to bottom center
        this.anchorPoint.set(0.5, 1.0);
    },

    /* -----

        update the player pos

    ------            */
    update : function (dt) {

        if (me.input.isKeyPressed("left"))    {
            this.body.vel.x -= this.body.accel.x * me.timer.tick;
            this.renderable.flipX(true);
        } else if (me.input.isKeyPressed("right")) {
            this.body.vel.x += this.body.accel.x * me.timer.tick;
            this.renderable.flipX(false);
        }

        if (me.input.isKeyPressed("jump")) {
            this.body.jumping = true;

            if (this.multipleJump <= 2) {
                // easy "math" for double jump
                this.body.vel.y -= (this.body.maxVel.y * this.multipleJump++) * me.timer.tick;
                me.audio.play("jump", false);
            }
        }
        else if (!this.body.falling && !this.body.jumping) {
            // reset the multipleJump flag if on the ground
            this.multipleJump = 1;
        }
        else if (this.body.falling && this.multipleJump < 2) {
            // reset the multipleJump flag if falling
            this.multipleJump = 2;
        }

        // apply physics to the body (this moves the entity)
        this.body.update(dt);

        // check if we fell into a hole
        if (!this.inViewport && (this.pos.y > me.video.renderer.getHeight())) {
            // if yes reset the game
            me.game.world.removeChild(this);
            me.game.viewport.fadeIn("#fff", 150, function(){
                me.audio.play("die", false);
                me.levelDirector.reloadLevel();
                me.game.viewport.fadeOut("#fff", 150);
            });
            return true;
        }

        // handle collisions against other shapes
        me.collision.check(this);

        // check if we moved (an "idle" animation would definitely be cleaner)
        if (this.body.vel.x !== 0 || this.body.vel.y !== 0 ||
            (this.renderable && this.renderable.isFlickering())
        ) {
            this._super(me.Entity, "update", [dt]);
            return true;
        }

        return false;
    },


    /**
     * colision handler
     */
    onCollision : function (response, other) {
        switch (other.body.collisionType) {
            case me.collision.types.WORLD_SHAPE:
                // Simulate a platform object
                if (other.type === "platform") {
                    if (this.body.falling &&
                        !me.input.isKeyPressed("down") &&
                        // Shortest overlap would move the player upward
                        (response.overlapV.y > 0) &&
                        // The velocity is reasonably fast enough to have penetrated to the overlap depth
                        (~~this.body.vel.y >= ~~response.overlapV.y)
                    ) {
                        // Disable collision on the x axis
                        response.overlapV.x = 0;
                        // Repond to the platform (it is solid)
                        return true;
                    }
                    // Do not respond to the platform (pass through)
                    return false;
                }

                // Custom collision response for slopes
                else if (other.type === "slope") {
                    // Always adjust the collision response upward
                    response.overlapV.y = Math.abs(response.overlap);
                    response.overlapV.x = 0;

                    // Respond to the slope (it is solid)
                    return true;
                }
                break;

            case me.collision.types.ENEMY_OBJECT:
                if (!other.isMovingEnemy) {
                    // spike or any other fixed danger
                    this.body.vel.y -= this.body.maxVel.y * me.timer.tick;
                    this.hurt();
                }
                else {
                    // a regular moving enemy entity
                    if ((response.overlapV.y > 0) && this.body.falling) {
                        // jump
                        this.body.vel.y -= this.body.maxVel.y * 1.5 * me.timer.tick;
                    }
                    else {
                        this.hurt();
                    }
                    // Not solid
                    return false;
                }
                break;

            default:
                // Do not respond to other objects (e.g. coins)
                return false;
        }

        // Make the object solid
        return true;
    },


    /**
     * ouch
     */
    hurt : function () {
        if (!this.renderable.flickering)
        {
            this.renderable.flicker(750);
            // flash the screen
            me.game.viewport.fadeIn("#FFFFFF", 75);
            me.audio.play("die", false);
        }
    }
});

/**
 * a coin (collectable) entiry
 */
game.CoinEntity = me.CollectableEntity.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {

        // call the super constructor
        this._super(me.CollectableEntity, "init", [x, y , settings]);

        // add the coin sprite as renderable
        this.renderable = game.texture.createSpriteFromName("coin.png");

        // set the renderable position to center
        this.anchorPoint.set(0.5, 0.5);
    },

    /**
     * collision handling
     */
    onCollision : function (/*response*/) {

        // do something when collide
        me.audio.play("cling", false);
        // give some score
        game.data.score += 250;

        //avoid further collision and delete it
        this.body.setCollisionMask(me.collision.types.NO_OBJECT);

        me.game.world.removeChild(this);

        return false;
    }
});

/**
 * An enemy entity
 * follow a horizontal path defined by the box size in Tiled
 */
game.PathEnemyEntity = me.Entity.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {

        // save the area size defined in Tiled
        var width = settings.width || settings.framewidth;

        // adjust the setting size to the sprite one
        settings.width = settings.framewidth;
        settings.height = settings.frameheight;

        // redefine the default shape (used to define path) with a shape matching the renderable
        settings.shapes[0] = new me.Rect(0, 0, settings.framewidth, settings.frameheight);

        // call the super constructor
        this._super(me.Entity, "init", [x, y , settings]);

        // set start/end position based on the initial area size
        x = this.pos.x;
        this.startX = x;
        this.endX   = x + width - settings.framewidth;
        this.pos.x  = x + width - settings.framewidth;

        // apply gravity setting if specified
        this.body.gravity = settings.gravity || me.sys.gravity;

        this.walkLeft = false;

        // walking & jumping speed
        this.body.setVelocity(settings.velX || 1, settings.velY || 6);

        // set a "enemyObject" type
        this.body.collisionType = me.collision.types.ENEMY_OBJECT;

        // don't update the entities when out of the viewport
        this.alwaysUpdate = false;

        // a specific flag to recognize these enemies
        this.isMovingEnemy = true;
    },


    /**
     * manage the enemy movement
     */
    update : function (dt) {

        if (this.alive)    {
            if (this.walkLeft && this.pos.x <= this.startX) {
                this.body.vel.x = this.body.accel.x * me.timer.tick;
                this.walkLeft = false;
                this.renderable.flipX(true);
            } else if (!this.walkLeft && this.pos.x >= this.endX) {
                this.body.vel.x = -this.body.accel.x * me.timer.tick;
                this.walkLeft = true;
                this.renderable.flipX(false);
            }

            // check & update movement
            this.body.update(dt);

        }

        // return true if we moved of if flickering
        return (this._super(me.Entity, "update", [dt]) || this.body.vel.x !== 0 || this.body.vel.y !== 0);
    },

    /**
     * collision handle
     */
    onCollision : function (response) {
        // res.y >0 means touched by something on the bottom
        // which mean at top position for this one
        if (this.alive && (response.overlapV.y > 0) && response.a.body.falling) {
            // make it dead
            this.alive = false;
            //avoid further collision and delete it
            this.body.setCollisionMask(me.collision.types.NO_OBJECT);
            // set dead animation
            this.renderable.setCurrentAnimation("dead");
            // make it flicker and call destroy once timer finished
            var self = this;
            this.renderable.flicker(750, function () {
                me.game.world.removeChild(self);
            });
            // dead sfx
            me.audio.play("enemykill", false);
            // give some score
            game.data.score += 150;
        }

        return false;
    }

});

/**
 * An Slime enemy entity
 * follow a horizontal path defined by the box size in Tiled
 */
game.SlimeEnemyEntity = game.PathEnemyEntity.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // super constructor
        this._super(game.PathEnemyEntity, "init", [x, y, settings]);

        // set a renderable
        this.renderable = game.texture.createAnimationFromName([
            "slime_normal.png", "slime_walk.png", "slime_dead.png"
        ]);

        // custom animation speed ?
        if (settings.animationspeed) {
            this.renderable.animationspeed = settings.animationspeed;
        }

        // walking animatin
        this.renderable.addAnimation ("walk", ["slime_normal.png", "slime_walk.png"]);
        // dead animatin
        this.renderable.addAnimation ("dead", ["slime_dead.png"]);

        // set default one
        this.renderable.setCurrentAnimation("walk");

        // set the renderable position to bottom center
        this.anchorPoint.set(0.5, 1.0);

    }
});

/**
 * An Fly enemy entity
 * follow a horizontal path defined by the box size in Tiled
 */
game.FlyEnemyEntity = game.PathEnemyEntity.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // super constructor
        this._super(game.PathEnemyEntity, "init", [x, y, settings]);

        // set a renderable
        this.renderable = game.texture.createAnimationFromName([
            "fly_normal.png", "fly_fly.png", "fly_dead.png"
        ]);

        // custom animation speed ?
        if (settings.animationspeed) {
            this.renderable.animationspeed = settings.animationspeed;
        }

        // walking animatin
        this.renderable.addAnimation ("walk", ["fly_normal.png", "fly_fly.png"]);
        // dead animatin
        this.renderable.addAnimation ("dead", ["fly_dead.png"]);

        // set default one
        this.renderable.setCurrentAnimation("walk");

        // set the renderable position to bottom center
        this.anchorPoint.set(0.5, 1.0);
    }
});
