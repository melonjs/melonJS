game.square = me.DraggableEntity.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the super constructor
        this._super(me.DraggableEntity, "init", [x, y, settings]);
        // set the color to white
        this.color = "white";
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
        renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
    },
    /**
     * dragStart overwrite function
     */
    dragStart: function (e) {
        // call the super function
        this._super(me.DraggableEntity, "dragStart", [e]);
        // set the color to blue
        this.color = "blue";
    },
    dragEnd: function (e) {
        // call the super function
        this._super(me.DraggableEntity, "dragEnd", [e]);
        // set the color to white
        this.color = "white";
    }
});
