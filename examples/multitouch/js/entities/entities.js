game.square = me.DraggableEntity.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the super constructor
        this._super(me.DraggableEntity, "init", [x, y, settings]);
        // set the color to white
        this.color = "white";
        // set the font we want to use
        this.font = new me.Font("Arial", 100, "black");
        this.font.bold();
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
        renderer.setColor(this.color);
        renderer.fillRect(0, 0, this.width, this.height);
        this.font.draw(renderer, "" + this.pos.z, 0, 0);
    },

    /**
     * dragStart overwrite function
     */
    dragStart: function (e) {
        // call the super function
        this._super(me.DraggableEntity, "dragStart", [e]);
        // set the color to blue
        this.color = "blue";
        // move this item to the top
        var nextChild = this.ancestor.getNextChild(this);
        if (nextChild !== undefined && nextChild.pos.z < Infinity) {
            this.ancestor.moveUp(this);
        };
    },

    dragEnd: function (e) {
        // call the super function
        this._super(me.DraggableEntity, "dragEnd", [e]);
        // set the color to white
        this.color = "white";
    }
});
