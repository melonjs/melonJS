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
