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
        this.font = new me.Font("Verdana", 15, "black");
        this.font.bold();
        // set the text
        this.text = "Drag me";
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
        this.font.draw(renderer, this.text, this.pos.x, this.pos.y);
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

game.droptarget = me.DroptargetEntity.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the parent constructor
        this._super(me.DroptargetEntity, "init", [x, y, settings]);
        // set the color to white
        this.color = "red";
        // set the font we want to use
        this.font = new me.Font("Verdana", 15, "black");
        this.font.bold();
        // set the text
        this.text = "Drop on me\n\nAnd I\"ll turn green\n\ncheckmethod: overlap";
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
        this.font.draw(renderer, this.text, this.pos.x, this.pos.y);
    },
    /**
     * drop overwrite function
     */
    drop: function (e) {
        // save a reference to this to use in the timeout
        var self = this;
        // call the super function
        this._super(me.DroptargetEntity, "draw", [e]);
        // indicate a succesful drop
        this.color = "green";
        // set the color back to red after a second
        window.setTimeout(function () {
            self.color = "red";
        }, 1000);
    }
});

game.droptarget2 = game.droptarget.extend({
    /**
     * constructor
     */
    init: function (x, y, settings) {
        // call the super constructor
        this._super(game.droptarget, "init", [x, y, settings]);
        // set the color to white
        this.color = "red";
        // set the font we want to use
        this.font = new me.Font("Verdana", 15, new me.Color(0, 0, 0));
        this.font.bold();
        // set the text
        this.text = "Drop on me\n\nAnd I\"ll turn green\n\ncheckmethod: contains";
        // set the check method to "contains" (default is "overlap")
        this.setCheckMethod(this.CHECKMETHOD_CONTAINS);
    }
});
