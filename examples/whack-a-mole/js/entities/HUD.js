

/**
 * a HUD container and child items
 */

game.HUD = game.HUD || {};


game.HUD.Container = me.Container.extend({

    init: function() {
        // call the constructor
        this._super(me.Container, "init");

        // persistent across level change
        this.isPersistent = true;

        // make sure our object is always draw first
        this.z = Infinity;

        // give a name
        this.name = "HUD";

        // add our child score object at position
        this.addChild(new game.HUD.ScoreItem("score", "left", 10, 10));

        // add our child score object at position
        this.addChild(new game.HUD.ScoreItem("hiscore", "right", (me.video.renderer.getWidth() - 10), 10));
    }
});


/**
 * a basic HUD item to display score
 */
game.HUD.ScoreItem = me.Renderable.extend( {
    /**
     * constructor
     */
    init: function(score, align, x, y) {

        // call the super constructor
        // (size does not matter here)
        this._super(me.Renderable, "init", [x, y, 10, 10]);

        // create a font
        this.font = new me.BitmapFont(me.loader.getBinary('PressStart2P'), me.loader.getImage('PressStart2P'), 1.5, align, "top");

        // ref to the score variable
        this.scoreRef = score;

        // make sure we use screen coordinates
        this.floating = true;
    },

    /**
     * draw the score
     */
    draw : function (context) {
        this.font.draw (context, game.data[this.scoreRef], this.pos.x, this.pos.y);
    }

});
