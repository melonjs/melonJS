game.square = (function (BaseEntity, DraggableEntity) {
    return function (x, y, settings) {
            // construct a new base entity instance
        var base = new BaseEntity(x, y, settings),
            // add the draggable ability to the mix
            draggable = base.mix(DraggableEntity(base)),
            // set the initial color to white
            color = 'white',
            // set the font we want to use
            font = new me.Font('Verdana', 15, 'black');
            // set the text
            text = 'Drag me',
            // mix in some custom methods
            obj = draggable.mix({
                draw: function (context) {
                    context.fillStyle = color;
                    context.fillRect(
                        this.pos.x,
                        this.pos.y,
                        this.width,
                        this.height
                    );
                    font.draw(context, text, this.pos.x, this.pos.y);
                },
                dragStart: function () {
                    color = 'green';
                },
                dragMove: function () {
                    color = 'blue';
                },
                dragEnd: function () {
                    color = 'white';
                }
            });

        // make the font bold
        font.bold();
        // return the square entity
        return obj;
    }
}(me.ObjectEntity, me.DraggableEntity));

game.droptarget = (function (BaseEntity, DroptargetEntity) {
    return function (x, y, settings) {
            // construct a new base entity instance
        var base = new BaseEntity(x, y, settings),
            // add the droptarget ability to the mix
            droptarget = base.mix(DroptargetEntity(base)),
            // set the initial color to red
            color = 'red',
            // set the font we want to use
            font = new me.Font('Verdana', 15, 'black');
            // set the text
            text = 'Drop on me\n\nAnd I\'ll turn green\n\ncheckmethod: overlap',
            // mix in some custom methods
            obj = droptarget.mix({
                draw: function (context) {
                    context.fillStyle = color;
                    context.fillRect(
                        this.pos.x,
                        this.pos.y,
                        this.width,
                        this.height
                    );
                    font.draw(context, text, this.pos.x, this.pos.y);
                },
                drop: function (e) {
                    // indicate a succesful drop, set color to green
                    color = 'green';
                    // set the color back to red after a second
                    window.setTimeout(function () {
                        color = 'red';
                    }, 1000);
                }
            });

        // make the font bold
        font.bold();
        // return the droptarget entity
        return obj;
    }
}(me.ObjectEntity, me.DroptargetEntity));

game.droptarget2 = function(x, y, settings) {
    var obj = game.droptarget(x, y, settings);
        obj.setCheckMethod(obj.CHECKMETHOD_CONTAINS);
    return obj;
};
