
// a draggable square entity
game.Square = me.Entity.extend({
     /**
     * constructor
     */
    init: function (x, y, settings) {
        // ensure we do not create a default shape
        //settings.shapes = [];
        // call the super constructor
        this._super(me.Entity, "init", [x, y, settings]);

        //this.body.addShape(new me.Rect(x, y, this.width, this.height));

        // status flags
        this.selected = false;
        this.hover = false;

        // to memorize where we grab the shape
        this.grabOffset = new me.Vector2d(0,0);

        // turn red once touched by a line
        this.color = new me.Color(0, 255, 0);

        this.isColliding = false;
    },

    onActivateEvent: function () {
        //register on mouse/touch event
        me.input.registerPointerEvent("pointerdown", this, this.onSelect.bind(this));
        me.input.registerPointerEvent("pointerup", this, this.onRelease.bind(this));
        me.input.registerPointerEvent("pointercancel", this, this.onRelease.bind(this));
        me.input.registerPointerEvent("pointermove", this, this.pointerMove.bind(this));
    },

    /**
     * pointermove function
     */
    pointerMove: function (event) {
        if (this.selected) {
            // follow the pointer
            me.game.world.moveUp(this);
            this.pos.set(event.gameX, event.gameY, this.pos.z);
            this.pos.sub(this.grabOffset);
        }
    },


    // mouse down function
    onSelect : function (event) {
        if (this.selected === false) {
            // manually calculate the relative coordinates for the body shapes
            // since only the bounding box is used by the input event manager
            var parentPos = this.ancestor.getBounds().pos;
            var x = event.gameX - this.pos.x - parentPos.x;
            var y = event.gameY - this.pos.y - parentPos.y;

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
                this.selected = true;
            }
        }
        return this.seleted;
    },

    // mouse up function
    onRelease : function (/*event*/) {
        this.selected = false;
        // don"t propagate the event furthermore
        return false;
    },

    /**
     * update function
     */
    update: function () {
        return true;
    },

    /**
     * draw the square
     */
    draw: function (renderer) {
        var lineWidth = 2;

        if (this.isColliding === true) {
            this.color.setColor(255, 0, 0);
        } else {
            this.color.setColor(0, 255, 0);
        }

        renderer.setGlobalAlpha(0.5);
        renderer.setColor(this.color);
        renderer.fillRect(0, 0, this.width, this.height);
        renderer.setGlobalAlpha(1.0);
        renderer.setLineWidth(lineWidth);
        renderer.strokeRect(
            lineWidth,
            lineWidth,
            this.width - lineWidth * 2,
            this.height - lineWidth * 2
        );

        // reset the colliding flag
        this.isColliding = false;
    }
});
