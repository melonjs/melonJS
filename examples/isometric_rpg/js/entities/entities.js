
/************************************************************************************/
/*                                                                                  */
/*        a player entity                                                           */
/*                                                                                  */
/************************************************************************************/
game.PlayerEntity = me.Entity.extend({
    init: function(x, y, settings) {
        // call the constructor
        this._super(me.Entity, 'init', [x, y , settings]);

        // disable gravity
        this.body.gravity = 0;

        // walking & jumping speed
        this.body.setVelocity(2.5, 2.5);
        this.body.setFriction(0.4,0.4);

        // set the display around our position
        me.game.viewport.follow(this, me.game.viewport.AXIS.BOTH);

        // enable keyboard
        me.input.bindKey(me.input.KEY.LEFT,  "left");
        me.input.bindKey(me.input.KEY.RIGHT, "right");
        me.input.bindKey(me.input.KEY.UP,    "up");
        me.input.bindKey(me.input.KEY.DOWN,  "down");
        
        // the main player spritesheet 
        var texture =  new me.video.renderer.Texture({framewidth:32, frameheight:32}, me.loader.getImage("Blank_Sprite_Sheet_4_2_by_KnightYamato"));
        
        // create a new animationSheet object 
        this.renderable = texture.createAnimationFromName([0, 1, 2, 3, 4, 5, 6, 7, 8]);
        // define an additional basic walking animation
        this.renderable.addAnimation ("simple_walk", [0,1,2]);
        // set the default animation
        this.renderable.setCurrentAnimation("simple_walk");
    },

    /* -----

        update the player pos

    ------            */
    update : function (dt) {

        if (me.input.isKeyPressed('left')) {
            // update the entity velocity
            this.body.vel.x -= this.body.accel.x * me.timer.tick;
        } else if (me.input.isKeyPressed('right')) {
            // update the entity velocity
            this.body.vel.x += this.body.accel.x * me.timer.tick;
        } else {
            this.body.vel.x = 0;
        }
        if (me.input.isKeyPressed('up')) {
            // update the entity velocity
            this.body.vel.y -= this.body.accel.y * me.timer.tick;
        } else if (me.input.isKeyPressed('down')) {
            // update the entity velocity
            this.body.vel.y += this.body.accel.y * me.timer.tick;
        } else {
            this.body.vel.y = 0;
        }

        // check for collision with environment
        this.body.update(dt);
        me.collision.check(this);

        return true;
    },

    onCollision : function () {
        return true;
    }
});
