/************************************************************************************/
/*                                                                                  */
/*     Base entity that predicts its position based on the last update              */
/*                                                                                  */
/************************************************************************************/
game.FramePredictionEntity = me.Entity.extend({
   
    init: function(x, y, settings) {
        this._super(me.Entity, "init", [x, y , settings]);
    },
    
    draw: function(renderer) {
        // Predict the next position to draw at based on velocity
        var updateInterval = (me.timer.getTime() - me.timer.lastUpdate) / ( (1000/me.sys.updatesPerSecond) );
        var xOffset = this.body.vel.x * updateInterval;
        var yOffset = this.body.vel.y * updateInterval;
        renderer.translate(xOffset, yOffset);
        this._super(me.Entity, "draw", [renderer]);
        renderer.translate(-xOffset, -yOffset);
    }
    
});

/************************************************************************************/
/*                                                                                  */
/*     Simple ball that bounces off the side of the screen                          */
/*                                                                                  */
/************************************************************************************/
game.BallEntity = game.FramePredictionEntity.extend({
    
    init: function(x, y, settings) {
        this._super(game.FramePredictionEntity, "init", [x, y , settings]);
        
        this.alwaysUpdate = true;
        
        this.body.setVelocity(10, 10);
        this.body.setFriction(0, 0);
        this.body.gravity = 0;
        
        this.renderable = new me.Sprite(0, 0, {
            image: me.loader.getImage("ball")
        });
        
        me.game.viewport.follow(this, me.game.viewport.AXIS.BOTH);
        
        this.xDir = 1;
        this.yDir = 1;
        
    },
    
    update : function (dt) {
        
        // Move entity
        this.body.vel.x += this.xDir * 4;
        this.body.vel.y += this.yDir * 4;
        
        // Bounce off room boundaries
        if (this.pos.x < 0) {
            this.xDir = 1;
        }
        if (this.pos.y < 0) {
            this.yDir = 1;
        }
        if (this.pos.x > 800-32) {
            this.xDir = -1;
        }
        if (this.pos.y > 600-32) {
            this.yDir = -1;
        }
        
        this.body.update(dt);
        this._super(game.FramePredictionEntity, "update", [dt]);
        return true;
    }
    
});