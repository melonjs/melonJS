

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

        // Use screen coordinates
        this.floating = true;

        // make sure our object is always draw first
        this.z = Infinity;

        // give a name
        this.name = "HUD";

        // add our child score object at position
        this.addChild(new game.HUD.ScoreItem(-10, -10));

        // add our audio control object
        this.addChild(new game.HUD.AudioControl(10, 10));

        if (!me.device.isMobile) {
            // add our fullscreen control object
            this.addChild(new game.HUD.FSControl(10 + 48 + 10, 10));
        }
    }
});

/**
 * a basic control to toggle fullscreen on/off
 */
game.HUD.FSControl = me.GUI_Object.extend({
    /**
     * constructor
     */
    init: function(x, y) {
        this._super(me.GUI_Object, "init", [ x, y, {
            image: game.texture,
            region : "shadedDark30.png"
        } ]);
        this.setOpacity(0.5);
        this.anchorPoint.set(0, 0);
    },

    /**
     * function called when the pointer is over the object
     */
    onOver : function (/* event */) {
        this.setOpacity(1.0);
    },

    /**
     * function called when the pointer is leaving the object area
     */
    onOut : function (/* event */) {
        this.setOpacity(0.5);
    },

    /**
     * function called when the object is clicked on
     */
    onClick : function (/* event */) {
        if (!me.device.isFullscreen) {
            me.device.requestFullscreen();
        } else {
            me.device.exitFullscreen();
        }
        return false;
    }
});

/**
 * a basic control to toggle fullscreen on/off
 */
game.HUD.AudioControl = me.GUI_Object.extend({
    /**
     * constructor
     */
    init: function(x, y) {
        this._super(me.GUI_Object, "init", [ x, y, {
            image: game.texture,
            region : "shadedDark13.png" // ON by default
        } ]);
        this.anchorPoint.set(0, 0);
        this.setOpacity(0.5);
        this.isMute = false;
    },

    /**
     * function called when the pointer is over the object
     */
    onOver : function (/* event */) {
        this.setOpacity(1.0);
    },

    /**
     * function called when the pointer is leaving the object area
     */
    onOut : function (/* event */) {
        this.setOpacity(0.5);
    },

    /**
     * function called when the object is clicked on
     */
    onClick : function (/* event */) {
        if (this.isMute) {
            me.audio.unmuteAll();
            this.setRegion(game.texture.getRegion("shadedDark13.png"));
            this.isMute = false;
        } else {
            me.audio.muteAll();
            this.setRegion(game.texture.getRegion("shadedDark15.png"));
            this.isMute = true;
        }
        return false;
    }
});

/**
 * a basic HUD item to display score
 */
game.HUD.ScoreItem = me.Renderable.extend({
    /**
     * constructor
     */
    init: function(x, y) {
        this.relative = new me.Vector2d(x, y);

        // call the super constructor
        // (size does not matter here)
        this._super(me.Renderable, "init", [
            me.game.viewport.width + x,
            me.game.viewport.height + y,
            10,
            10
        ]);

        // create a font
        this.font = new me.BitmapFont(me.loader.getBinary('PressStart2P'), me.loader.getImage('PressStart2P'), 1.0, "right", "bottom");

        // local copy of the global score
        this.score = -1;
    },

    /**
     * update function
     */
    update : function (/*dt*/) {
        this.pos.x = me.game.viewport.width + this.relative.x;
        this.pos.y = me.game.viewport.height + this.relative.y;

        // we don't draw anything fancy here, so just
        // return true if the score has been updated
        if (this.score !== game.data.score) {
            this.score = game.data.score;
            return true;
        }
        return false;
    },

    /**
     * draw the score
     */
    draw : function (renderer) {
        this.font.draw (renderer, game.data.score, this.pos.x, this.pos.y);
    }

});
