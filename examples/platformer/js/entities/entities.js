
/************************************************************************************/
/*                                                                                    */
/*        a player entity                                                                */
/*                                                                                    */
/************************************************************************************/
game.PlayerEntity = me.ObjectEntity.extend({
    init: function(x, y, settings) {
        // call the constructor
        this.parent(x, y , settings);

        // player can exit the viewport (jumping, falling into a hole, etc.)
        this.alwaysUpdate = true;

        // walking & jumping speed
        this.setVelocity(3, 15);
        this.setFriction(0.4,0);

        // update the hit box
        this.updateColRect(20,32, -1,0);
        this.dying = false;

        this.mutipleJump = 1;

        // set the display around our position
        me.game.viewport.follow(this, me.game.viewport.AXIS.HORIZONTAL);

        // enable keyboard
        me.input.bindKey(me.input.KEY.LEFT,     "left");
        me.input.bindKey(me.input.KEY.RIGHT, "right");
        me.input.bindKey(me.input.KEY.X,    "jump", true);
        me.input.bindKey(me.input.KEY.UP,    "up");
        me.input.bindKey(me.input.KEY.DOWN,    "down");


        // set a renderable
        this.renderable = game.texture.createAnimationFromName([
            "walk0001.png", "walk0002.png", "walk0003.png",
            "walk0004.png", "walk0005.png", "walk0006.png",
            "walk0007.png", "walk0008.png", "walk0009.png",
            "walk0010.png", "walk0011.png"
        ]);

        // define a basic walking animatin
        this.renderable.addAnimation ("walk",  ["walk0001.png", "walk0002.png", "walk0003.png"]);
        // set as default
        this.renderable.setCurrentAnimation("walk");

        // set the renderable position to bottom center
        this.anchorPoint.set(0.5, 1.0);
    },

    /* -----

        update the player pos

    ------            */
    update : function (time) {

        if (me.input.isKeyPressed('left'))    {
            this.vel.x -= this.accel.x * me.timer.tick;
            this.flipX(true);
        } else if (me.input.isKeyPressed('right')) {
            this.vel.x += this.accel.x * me.timer.tick;
            this.flipX(false);
        }

        if (me.input.isKeyPressed('jump')) {
            this.jumping = true;

            // reset the dblJump flag if off the ground
            this.mutipleJump = (this.vel.y === 0)?1:this.mutipleJump;

            if (this.mutipleJump<=2) {
                // easy 'math' for double jump
                this.vel.y -= (this.maxVel.y * this.mutipleJump++) * me.timer.tick;
                me.audio.play("jump", false);
            }
        }

        // check for collision with environment
        this.updateMovement();

        // check if we fell into a hole
        if (!this.inViewport && (this.pos.y > me.video.getHeight())) {
            // if yes reset the game
            me.game.remove(this);
            me.game.viewport.fadeIn('#fff', 150, function(){
                me.audio.play("die", false);
                me.levelDirector.reloadLevel();
                me.game.viewport.fadeOut('#fff', 150);
            });
            return true;
        }

        // check for collision with sthg
        var res = me.game.collide(this);

        if (res) {
            switch (res.obj.type) {
                case me.game.ENEMY_OBJECT : {
                    if ((res.y>0) && this.falling) {
                        // jump
                        this.vel.y -= this.maxVel.y * me.timer.tick;
                    } else {
                        this.hurt();
                    }
                    break;
                }

                case "spikeObject" :{
                    // jump & die
                    this.vel.y -= this.maxVel.y * me.timer.tick;
                    this.hurt();
                    break;
                }

                default : break;
            }
        }

        // check if we moved (a "stand" animation would definitely be cleaner)
        if (this.vel.x!=0 || this.vel.y!=0 || (this.renderable&&this.renderable.isFlickering())) {
            this.parent(time);
            return true;
        }

        return false;
    },


    /**
     * ouch
     */
    hurt : function () {
        if (!this.renderable.flickering)
        {
            this.renderable.flicker(45);
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

        // call the parent constructor
        this.parent(x, y , settings);

        // add the coin sprite as renderable
        this.renderable = game.texture.createSpriteFromName("coin.png");

        // set the renderable position to bottom center
        this.anchorPoint.set(0.5, 1.0);

    },

    /**
     * collision handling
     */
    onCollision : function () {
        // do something when collide
        me.audio.play("cling", false);
        // give some score
        game.data.score += 250;

        //avoid further collision and delete it
        this.collidable = false;
        me.game.remove(this);
    }

});

/**
 * An enemy entity
 * follow a horizontal path defined by the box size in Tiled
 */
game.PathEnemyEntity = me.ObjectEntity.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the parent constructor
        this.parent(x, y , settings);

        // apply gravity setting if specified
        this.gravity = settings.gravity || me.sys.gravity;

        // set start/end position
        x = this.pos.x;
        var width = settings.width || this.width;
        this.startX = x;
        this.endX   = x + width - settings.spritewidth
        this.pos.x  = x + width - settings.spritewidth;

        this.walkLeft = false;

        // walking & jumping speed
        this.setVelocity(settings.velX || 1, settings.velY || 6);

        // make it collidable
        this.collidable = true;
        this.type = me.game.ENEMY_OBJECT;

        // don't update the entities when out of the viewport
        this.alwaysUpdate = false;
    },


    /**
     * manage the enemy movement
     */
    update : function (time) {

        if (this.alive)    {
            if (this.walkLeft && this.pos.x <= this.startX) {
                this.vel.x = this.accel.x * me.timer.tick;
                this.walkLeft = false;
                this.flipX(true);
            } else if (!this.walkLeft && this.pos.x >= this.endX) {
                this.vel.x = -this.accel.x * me.timer.tick;
                this.walkLeft = true;
                this.flipX(false);
            }
        } else {
            this.vel.x = 0;
        }

        // check & update movement
        this.updateMovement();

        // return true if we moved of if flickering
        return (this.parent(time) || this.vel.x != 0 || this.vel.y != 0);
    },

    /**
     * collision handle
     */
    onCollision : function (res, obj) {
        // res.y >0 means touched by something on the bottom
        // which mean at top position for this one
        if (this.alive && (res.y > 0) && obj.falling) {
            // make it dead
            this.alive = false;
            // and not collidable anymore
            this.collidable = false;
            // set dead animation
            this.renderable.setCurrentAnimation("dead");
            // make it flicker and call destroy once timer finished
            var self = this;
            this.renderable.flicker(45, function(){me.game.remove(self)});
            // dead sfx
            me.audio.play("enemykill", false);
            // give some score
            game.data.score += 150;
        }
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
        // parent constructor
        this.parent(x, y, settings);

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
        // parent constructor
        this.parent(x, y, settings);

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
