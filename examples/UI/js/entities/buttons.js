/**
 * UI Objects
 */

game.UI = game.UI || {};

/**
 * a basic button control
 */
game.UI.ButtonUI = me.GUI_Object.extend({
    /**
     * constructor
     */
    init: function(x, y, color, label) {
        this._super(me.GUI_Object, "init", [ x, y, {
            image: game.texture,
            region : color + "_button04"
        } ]);

        // offset of the two used images in the texture
        this.unclicked_region = game.texture.getRegion(color + "_button04");
        this.clicked_region = game.texture.getRegion(color + "_button05");

        this.anchorPoint.set(0, 0);
        this.setOpacity(0.5);

        this.font = new me.Font("kenpixel", 12, "black");
        this.font.textAlign = "center";
        this.font.textBaseline = "middle";

        this.label = label;

        // only the parent container is a floating object
        this.floating = false;
    },

    /**
     * function called when the object is clicked on
     */
    onClick : function (/* event */) {
        this.offset.setV(this.clicked_region.offset);
        // account for the different sprite size
        this.pos.y += this.height - this.clicked_region.height ;
        this.height = this.clicked_region.height;
        // don't propagate the event
        return false;
    },

    /**
     * function called when the pointer button is released
     */
    onRelease : function (/* event */) {
        this.offset.setV(this.unclicked_region.offset);
        // account for the different sprite size
        this.pos.y -= this.unclicked_region.height - this.height;
        this.height = this.unclicked_region.height;
        // don't propagate the event
        return false;
    },

    draw: function(renderer) {
        this._super(me.GUI_Object, "draw", [ renderer ]);
        this.font.draw(renderer,
            this.label,
            this.pos.x + this.width / 2,
            this.pos.y + this.height / 2
        );
    }
});

/**
 * a basic checkbox control
 */
game.UI.CheckBoxUI = me.GUI_Object.extend({
    /**
     * constructor
     */
    init: function(x, y, label_on, label_off) {
        this._super(me.GUI_Object, "init", [ x, y, {
            image: game.texture,
            region : "green_boxCheckmark" // default sprite (ON)
        } ]);

        // offset of the two used images in the texture
        this.on_offset = game.texture.getRegion("green_boxCheckmark").offset;
        this.off_offset = game.texture.getRegion("grey_boxCheckmark").offset;

        this.anchorPoint.set(0, 0);
        this.setOpacity(0.5);

        this.isChecked = true;

        this.label_on = label_on;
        this.label_off = label_off;

        this.font = new me.Font("kenpixel", 12, "black");
        this.font.textAlign = "left";
        this.font.textBaseline = "middle";

        // only the parent container is a floating object
        this.floating = false;
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
        if (this.isChecked) {
            this.offset.setV(this.off_offset);
            this.isChecked = false;
        } else {
            this.offset.setV(this.on_offset);
            this.isChecked = true;
        }
        // don't propagate the event
        return false;
    },

    draw: function(renderer) {
        this._super(me.GUI_Object, "draw", [ renderer ]);

        // save global alpha
        var alpha = renderer.globalAlpha();
        // sprite alpha value
        renderer.setGlobalAlpha(alpha * this.getOpacity());

        this.font.draw(renderer,
            " " + (this.isChecked ? this.label_on : this.label_off),
            this.pos.x + this.width,
            this.pos.y + this.height / 2
        );

        // restore global alpha
        renderer.setGlobalAlpha(alpha);
    }
});
