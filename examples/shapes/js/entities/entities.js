game.ShapeObject = me.Entity.extend({
     /**
     * constructor
     */
    init: function (x, y, settings) {
        // ensure we do not create a default shape
        settings.shapes = [];
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
        this.renderable = new me.Sprite(0, 0, {image: me.loader.getImage("orange")});
    }
});

game.Poly = game.ShapeObject.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the super constructor
        this._super(game.ShapeObject, 'init', [x, y, settings]);

        // add all PE shapes to the body
        this.body.addShapesFromJSON(me.loader.getJSON("shapesdef"), settings.sprite);

        // add the star sprite
        this.renderable = new me.Sprite(0, 0, {image: me.loader.getImage(settings.sprite)});
    },
    
});
