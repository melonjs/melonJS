game.square = me.DraggableEntity.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the parent constructor
        this.parent(x, y, settings);
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
    draw: function (context) {
        context.fillStyle = this.color;
        context.fillRect(this.pos.x, this.pos.y, this.width, this.height);
    },
    /**
     * dragStart overwrite function
     */
    dragStart: function (e) {
        // call the parent function
        this.parent(e);
        // set the color to blue
        this.color = 'blue';
    },
    dragEnd: function (e) {
        // call the parent function
        this.parent(e);
        // set the color to white
        this.color = 'white';
    }
});
