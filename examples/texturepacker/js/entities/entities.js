/**
 * Cap Guy entiry
 */
game.CapGuyEntity = me.Entity.extend({
    /**
     * constructor
     */
    init: function (x, y) {

        // call the super constructor
        this._super(me.Entity, "init", [-200, 50, {width : 100, height : 300}]);

        // create an animation using the cap guy sprites, and add as renderable
        this.renderable = game.texture.createAnimationFromName([
            "capguy/walk/0001", "capguy/walk/0002",
            "capguy/walk/0003", "capguy/walk/0004",
            "capguy/walk/0005", "capguy/walk/0006",
            "capguy/walk/0007", "capguy/walk/0008"
        ]);

        // enable this, since the entity starts off the viewport
        this.alwaysUpdate = true;
    },

    /**
     * manage the enemy movement
     */
    update : function (dt) {

        // just manually change the guy position
        this.pos.x += 0.3 * dt;

        // repeat once leaving the viewport
        if (this.pos.x >= me.game.viewport.width) {
            this.pos.x = 0;
        }

        // call the parent function
        this._super(me.Entity, "update", [dt]);

        return true;
    }
});
