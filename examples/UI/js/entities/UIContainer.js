/**
* a UI container
*/

game.UI = game.UI || {};

// a Panel type container
game.UI.Container = me.Container.extend({

    init: function(x, y, width, height, label) {
        // call the constructor
        this._super(me.Container, "init", [x, y, width, height]);

        this.anchorPoint.set(0, 0);

        // persistent across level change
        this.isPersistent = true;

        // use screen coordinates
        this.floating = true;

        // give a name
        this.name = "UIPanel";

        // back panel sprite
        this.panelSprite = game.texture.createSpriteFromName("grey_panel");
        this.panelSprite.anchorPoint.set(0, 0);
        // scale to match the container size
        this.panelSprite.scale(
            this.width / this.panelSprite.width,
            this.height / this.panelSprite.height
        );
        this.addChild(this.panelSprite);

        this.font = new me.Text(0, 0 ,{
            font: "kenpixel",
            size: 20,
            fillStyle: "black",
            textAlign: "center",
            textBaseline: "top",
            bold: true
        });

        this.label = label;

        // input status flags
        this.selected = false;
        this.hover = false;
        // to memorize where we grab the shape
        this.grabOffset = new me.Vector2d(0,0);
    },

    onActivateEvent: function () {
        // register on the global pointermove event
        this.handler = me.event.subscribe(me.event.POINTERMOVE, this.pointerMove.bind(this));
        //register on mouse/touch event
        me.input.registerPointerEvent("pointerdown", this, this.onSelect.bind(this));
        me.input.registerPointerEvent("pointerup", this, this.onRelease.bind(this));
        me.input.registerPointerEvent("pointercancel", this, this.onRelease.bind(this));

        // call the parent function
        this._super(me.Container, "onActivateEvent");
    },

    onDeactivateEvent: function () {
        // unregister on the global pointermove event
        me.event.unsubscribe(this.handler);
        // release pointer events
        me.input.releasePointerEvent("pointerdown", this);
        me.input.releasePointerEvent("pointerup", this);
        me.input.releasePointerEvent("pointercancel", this);

        // call the parent function
        this._super(me.Container, "onDeactivateEvent");
    },

    /**
     * pointermove function
     */
    pointerMove: function (event) {
        this.hover = this.getBounds().containsPoint(event.gameX, event.gameY);

        if (this.selected) {
            // follow the pointer
            this.pos.set(event.gameX, event.gameY, this.pos.z);
            this.pos.sub(this.grabOffset);
            this.updateChildBounds();
        }
    },

    // mouse down function
    onSelect : function (event) {
        if (this.hover === true) {
            this.grabOffset.set(event.gameX, event.gameY);
            this.grabOffset.sub(this.pos);
            this.selected = true;
            // don"t propagate the event furthermore
            return false;
        }
    },

    // mouse up function
    onRelease : function (/*event*/) {
        this.selected = false;
    },

    // update function
    update : function(dt) {
        this._super(me.Container, "update", [ dt ]);
        return true;
    },

    draw: function(renderer) {
        this._super(me.Container, "draw", [ renderer ]);
        this.font.draw(
            renderer,
            this.label,
            this.width / 2,
            16, // panel border
        );
    }

});
