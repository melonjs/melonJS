game.square = me.ObjectEntity.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the parent constructor
        this.parent(x, y, settings);
        // set the color to white
        this.color = "white";
        this.hoverColor = "red";

        this.addShape(new me.Rect({x:0, y:0}, this.width, this.height));

        this.hover = false;

        this.handler = me.event.subscribe("mousemove", this.mouseMove.bind(this));
    },

    /**
     * mousemove function
     */
    mouseMove: function (event) {
        this.hover = (this.getShape().containsPoint(event.gameX - this.pos.x, event.gameY - this.pos.y));
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
    draw: function (context) {
        context.translate(this.pos.x, this.pos.y);
        
        // draw the shape
        context.fillStyle = this.hover ? this.hoverColor:this.color;
        context.fillRect(this.getShape().pos.x, this.getShape().pos.y, this.getShape().width, this.getShape().height);

        context.translate(-this.pos.x, -this.pos.y);
    }
});

game.circle = me.ObjectEntity.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the parent constructor
        this.parent(x, y, settings);
        // set the color to white
        this.color = "white";
        this.hoverColor = "red";

        this.addShape(new me.Ellipse({x:0, y:0}, this.width, this.height));

        this.hover = false;

        this.handler = me.event.subscribe("mousemove", this.mouseMove.bind(this));
    },

    /**
     * mousemove function
     */
    mouseMove: function (event) {
        this.hover = (this.getShape().containsPoint(event.gameX - this.pos.x, event.gameY - this.pos.y));
        console.log(this.hover);
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
    draw: function (context) {
        context.translate(this.pos.x, this.pos.y);
        
        // http://tinyurl.com/opnro2r
        context.save();
        context.beginPath();

        context.translate(this.getShape().pos.x-this.getShape().radius.x, this.getShape().pos.y-this.getShape().radius.y);
        context.scale(this.getShape().radius.x, this.getShape().radius.y);
        context.arc(1, 1, 1, 0, 2 * Math.PI, false);

        context.restore();
        context.fillStyle = this.hover ? this.hoverColor:this.color;
        context.fill();

        context.translate(-this.pos.x, -this.pos.y);
    }
});
