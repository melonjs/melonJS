game.square = me.DraggableEntity.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the parent constructor
        this.parent(x, y, settings);
        // set the color to white
        this.color = "white";
        // set the font we want to use
        this.font = new me.Font('Verdana', 15, 'black');
        this.font.bold();
        // set the text
        this.text = 'Drag me';
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
        this.font.draw(context, this.text, this.pos.x, this.pos.y);
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

game.droptarget = me.DroptargetEntity.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the parent constructor
        this.parent(x, y, settings);
        // set the color to white
        this.color = "red";
        // set the font we want to use
        this.font = new me.Font('Verdana', 15, 'black');
        this.font.bold();
        // set the text
        this.text = 'Drop on me\n\nAnd I\'ll turn green\n\ncheckmethod: overlap';
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
        this.font.draw(context, this.text, this.pos.x, this.pos.y);
    },
    /**
     * drop overwrite function
     */
    drop: function (e) {
        // save a reference to this to use in the timeout
        var self = this;
        // call the parent function
        this.parent(e);
        // indicate a succesful drop
        this.color = 'green';
        // set the color back to red after a second
        window.setTimeout(function () {
            self.color = 'red';
        }, 1000);
    }
});

game.droptarget2 = game.droptarget.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the parent constructor
        this.parent(x, y, settings);
        // set the color to white
        this.color = "red";
        // set the font we want to use
        this.font = new me.Font('Verdana', 15, 'black');
        this.font.bold();
        // set the text
        this.text = 'Drop on me\n\nAnd I\'ll turn green\n\ncheckmethod: contains';
        // set the check method to 'contains' (default is 'overlap')
        this.setCheckMethod(this.CHECKMETHOD_CONTAINS);
    }
});
