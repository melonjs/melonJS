/**
* a UI container
*/

game.UI = game.UI || {};

// a Panel type container
game.UI.Container = me.Container.extend({

    init: function(x, y, width, height, label) {
        // call the constructor
        this._super(me.Container, "init", [x, y, width, height]);

        // persistent across level change
        this.isPersistent = true;

        // make sure our object is always draw first
        this.z = Infinity;

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

        // Panel Label
        this.LabelText = new (me.Renderable.extend({
            init: function() {
                this._super(me.Renderable, 'init', [0, 0, 10, 10]);
                this.font = new me.Font("kenpixel", 20, "black");
                this.font.textAlign = "center";
                this.font.textBaseline = "top";
                this.font.bold();
            },
            draw: function(renderer){
                this.font.draw (
                    renderer,
                    label,
                    this.pos.x,
                    this.pos.y);
            }
        }));
        this.LabelText.pos.set(
            this.width / 2,
            16, // panel border
            this.z
        )
        this.addChild(this.LabelText, 10);

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
        return this._super(me.Container, "update", [ dt ]) || this.hover;
    }
});
