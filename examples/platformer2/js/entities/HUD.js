

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
        this.addChild(new game.HUD.ScoreItem(-10, -40));
        
        // add our fullscreen control object
        this.addChild(new game.HUD.FSControl(10, 10));
        
        // add our audio control object
        this.addChild(new game.HUD.AudioControl(10 + 48 + 10, 10));
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
            image: undefined, // dummy one
            framewidth : 48,
            frameheight : 48
        } ]);
        // a renderable component
        this.renderable = game.texture.createSpriteFromName("shadedDark30.png")
        this.renderable.pos.setV(this.pos);
        this.renderable.setOpacity(0.5);
        this.renderable.anchorPoint.set(0, 0);
    },
    
    /**
     * function called when the pointer is over the object
     */
    onOver : function (/* event */) {
        this.renderable.setOpacity(1.0);
    },
    
    /**
     * function called when the pointer is leaving the object area
     */
    onOut : function (/* event */) {
        this.renderable.setOpacity(0.5);
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
    },

    draw : function (renderer) {
        this.renderable.draw(renderer);
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
            image: undefined, // dummy one
            framewidth : 48,
            frameheight : 48
        } ]);
        // a renderable component
        this.image_on = game.texture.createSpriteFromName("shadedDark13.png")
        this.image_off = game.texture.createSpriteFromName("shadedDark15.png")
        this.image_on.pos.setV(this.pos);
        this.image_off.pos.setV(this.pos);
        this.image_on.anchorPoint.set(0, 0);
        this.image_off.anchorPoint.set(0, 0);
        this.renderable = this.image_on;
        this.renderable.setOpacity(0.5);
        this.isMute = false;
    },
    
    /**
     * function called when the pointer is over the object
     */
    onOver : function (/* event */) {
        this.renderable.setOpacity(1.0);
    },
    
    /**
     * function called when the pointer is leaving the object area
     */
    onOut : function (/* event */) {
        this.renderable.setOpacity(0.5);
    },
    
    /**
     * function called when the object is clicked on
     */
    onClick : function (/* event */) {
        if (this.isMute) {
            me.audio.unmuteAll();
            this.renderable = this.image_on;
            this.isMute = false;
        } else {
            me.audio.muteAll();
            this.renderable = this.image_off;
            this.isMute = true;
        }
        return false;
    },

    draw : function (renderer) {
        this.renderable.draw(renderer);
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
        this.font = new me.BitmapFont("atascii", {x:24});
        this.font.alignText = "bottom";
        this.font.set("right", 1.6);

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
