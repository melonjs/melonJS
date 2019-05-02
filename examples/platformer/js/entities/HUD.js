/**
 * HUD namespace
 */
game.HUD = game.HUD || {};

/**
 * a HUD container and child items
 */
game.HUD.UIContainer = me.Container.extend({

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
        this.addChild(new game.HUD.AudioControl(36, 56));

        if (!me.device.isMobile) {
            // add our fullscreen control object
            this.addChild(new game.HUD.FSControl(36 + 10 + 48, 56));
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
        this.font = new me.BitmapText(0, 0, {
            font : "PressStart2P",
            textAlign : "right",
            textBaseline : "bottom"
        });

        // local copy of the global score
        this.score = -1;

        // recalculate the object position if the canvas is resize
        me.event.subscribe(me.event.CANVAS_ONRESIZE, (function(w, h){
            this.pos.set(w, h, 0).add(this.relative);
        }).bind(this));
    },

    /**
     * update function
     */
    update : function (/*dt*/) {
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
        this.font.draw(renderer, game.data.score, this.pos.x, this.pos.y);
    }

});
