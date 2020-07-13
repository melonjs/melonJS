game.CoinEntity = me.Sprite.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the super constructor
        this._super(me.Sprite, "init", [
            x, y ,
            Object.assign({
                image: game.texture,
                region : "coin.png"
            }, settings)
        ]);

        // add a physic body with an ellipse as body shape
        this.body = new me.Body(this, new me.Ellipse(this.width / 2, this.height / 2, this.width, this.height));

        // set the collision type
        this.body.collisionType = me.collision.types.COLLECTABLE_OBJECT;
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
