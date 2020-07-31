game.Sprite = me.Sprite.extend({
     /**
     * constructor
     */
    init: function (x, y, settings) {
        this._super(me.Sprite, "init", [ x, y, {image: settings.sprite} ]);

        // add a physic body with an ellipse as body shape
        this.body = new me.Body(this);
        this.body.gravityScale = 0;

        if (typeof settings.shape !== "undefined") {
            this.body.addShape(settings.shape);
        } else {
            this.body.addShape(me.loader.getJSON("shapesdef")[settings.sprite]);
        }

        // status flags
        this.selected = false;
        this.hover = false;

        // enable physic and input event for this renderable
        this.isKinematic = false;

        // to memorize where we grab the sprite
        this.grabOffset = new me.Vector2d(0,0);
    },

    onActivateEvent: function () {
        //register on mouse/touch event
        me.input.registerPointerEvent("pointerdown", this, this.onSelect.bind(this));
        me.input.registerPointerEvent("pointerup", this, this.onRelease.bind(this));
        me.input.registerPointerEvent("pointercancel", this, this.onRelease.bind(this));
        me.input.registerPointerEvent("pointermove", this, this.pointerMove.bind(this));
        me.input.registerPointerEvent("wheel", this, this.onScroll.bind(this));
    },

    /**
     * pointermove function
     */
    pointerMove: function (event) {
        if (this.selected) {
            // follow the pointer
            this.pos.set(event.gameX, event.gameY, this.pos.z);
            this.pos.sub(this.grabOffset);
            // don't propagate the event furthermore
            return false;
        }
    },

    /**
     * pointermove function
     */
    onScroll: function (event) {
        if (this.selected) {
            // default anchor point for renderable is 0.5, 0.5
            this.rotate(event.deltaY);

            // by default body rotate around the body center
            this.body.rotate(event.deltaY);

            // don't propagate the event furthermore
            return false;
        }
    },


    // mouse down function
    onSelect : function (event) {
        if (this.selected === false) {
            // manually calculate the relative coordinates for the body shapes
            // since only the bounding box is used by the input event manager
            var x = event.gameX - this.getBounds().pos.x + this.body.getBounds().pos.x;
            var y = event.gameY - this.getBounds().pos.y + this.body.getBounds().pos.y;

            // the pointer event system will use the object bounding rect, check then with with all defined shapes
            for (var i = this.body.shapes.length, shape; i--, (shape = this.body.shapes[i]);) {
                if (shape.containsPoint(x, y)) {
                    this.selected = true;
                    break;
                }
            }

            if (this.selected) {
                this.grabOffset.set(event.gameX, event.gameY);
                this.grabOffset.sub(this.pos);
            }
        }
        // don't propagate the event furthermore if selected
        return !this.selected;
    },

    // mouse up function
    onRelease : function (/*event*/) {
        this.selected = false;
        // don't propagate the event furthermore
        return false;
    },

    /**
     * update function
     */
    update: function () {
        return this.selected;
    },

    /**
     * draw the square
     */
    draw: function (renderer) {
        renderer.setGlobalAlpha(this.selected ? 1.0 : 0.5);
        this._super(me.Sprite, "draw", [renderer]);
    }
});
