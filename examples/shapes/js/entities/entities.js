game.ShapeObject = me.Entity.extend({
     /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the super constructor
        this._super(me.Entity, 'init', [x, y, settings]);
        this.hover = false;
        this.handler = me.event.subscribe("pointermove", this.mouseMove.bind(this));

        // to memorize where we grab the shape
        this.grabOffset = new me.Vector2d(0,0);
        
        //register on mouse/touch event
        me.input.registerPointerEvent('pointerdown', this, this.onSelect.bind(this));
        me.input.registerPointerEvent('pointerup', this, this.onRelease.bind(this));
    },

    /**
     * mousemove function
     */
    mouseMove: function (event) {
        this.hover = false;
        
        // the pointer event system will use the object bounding rect, check then with with all defined shapes
        if (this.inViewport && this.getBounds().containsPoint(event.gameX, event.gameY)) {
            for (var i = this.body.shapes.length, shape; i--, (shape = this.body.shapes[i]);) {
                if (shape.containsPoint(event.gameX - this.pos.x, event.gameY - this.pos.y)) {
                    this.hover = true;
                    break;
                }
            }
        }

        if (this.canMove) {
            // follow the mouse/finger
            this.pos.set(event.gameX, event.gameY);
            this.pos.sub(this.grabOffset);
            // update the body bounds
            this.updateBounds();
        }
    },
    

    // mouse down function
    onSelect : function (event) {
        // the pointer event system will use the object bounding rect, check then with with all defined shapes
        for (var i = this.body.shapes.length, shape; i--, (shape = this.body.shapes[i]);) {
            if (shape.containsPoint(event.gameX - this.pos.x, event.gameY - this.pos.y)) {
                this.grabOffset.set(event.gameX, event.gameY);
                this.grabOffset.sub(this.pos);
                this.canMove = true;
                // don't propagate the event furthermore
                return false;
            }
        }
        return true;
    },

    // mouse up function
    onRelease : function (event) {
        this.canMove = false;
        // don't propagate the event furthermore
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
        renderer.setGlobalAlpha(this.hover ? 1.0 : 0.5);
        this._super(me.Entity, 'draw', [renderer]);
        renderer.setGlobalAlpha(1.0);
    }
});

game.Square = game.ShapeObject.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the super constructor
        this._super(game.ShapeObject, 'init', [x, y, settings]);

        // add a rectangular shape
        this.body.addShape(new me.Rect(0, 0, this.width, this.height));

        // pienapple
        this.renderable = new me.Sprite(0, 0, me.loader.getImage("sprites"), 20, 24);
        this.renderable.offset.x = 93;
        this.renderable.offset.y = 151;
        this.renderable.scale(7.5);
    }
});

game.Circle = game.ShapeObject.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the super constructor
        this._super(game.ShapeObject, 'init', [x, y, settings]);

        // add an ellipse shape
        this.body.addShape(new me.Ellipse(this.width/2, this.height/2, this.width, this.height));

        // tomato
        this.renderable = new me.Sprite(0, 0, me.loader.getImage("sprites"), 20, 20);
        this.renderable.offset.x = 65;
        this.renderable.offset.y = 153;
        this.renderable.scale(7.5);
    }
});

game.Poly = game.ShapeObject.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the super constructor
        this._super(game.ShapeObject, 'init', [x, y, settings]);

        var data = me.loader.getJSON("star_body")["sprites"];
        
        // few notes : compensate for the offset origin in the tileset and adjust the size
        // to match the sprite size (7.5 scale ratio)
   
        // origin point of the shape in the tileset
        var origin = new me.Vector2d(
            data[0].shape[0],
            data[0].shape[1]
        ).negate().scale(7.5); // negate and scale
        
        // go through all shapes and add them to the entity body
        for (var i = 0; i < data.length; i++) {
            var points = [];
            for (var s = 0; s < data[i].shape.length; s += 2)
            {
                points.push(new me.Vector2d(data[i].shape[s],data[i].shape[s + 1]));
            }
            this.body.addShape(new me.Polygon(0, 0, points).scale(7.5).translateV(origin)); // scale the polygon and translate back to (0,0)
        }
        // make sure the bounding box is up-to-date
        this.body.updateBounds();

        // add the star sprite
        this.renderable = new me.Sprite(0, 0, me.loader.getImage("sprites"), 24, 24);
        this.renderable.offset.x = 86;
        this.renderable.offset.y = 241;
        this.renderable.scale(7.5);
    }
});
