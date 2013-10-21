game.square = me.import([
    // import our dependencies
    'ObjectEntity',
    'DraggableEntity'
],
// the dependencies will be passed to the callback functon
function (BaseEntity, DraggableEntity) {
    return function (x, y, settings) {
            // construct a new base entity instance
        var base = new BaseEntity(x, y, settings),
            // add the draggable ability to the mix
            draggable = base.mix(DraggableEntity(base)),
            // set the initial color to white
            color = 'white',
            // set the font we want to use
            font = new me.Font('Verdana', 15, 'black'),
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
    };
});

game.droptarget = me.import([
    // import our dependencies
    'ObjectEntity',
    'DroptargetEntity'
],
// the dependencies will be passed to the callback functon
function (BaseEntity, DroptargetEntity) {
    return function (x, y, settings) {
            // construct a new base entity instance
        var base = new BaseEntity(x, y, settings),
            // add the droptarget ability to the mix
            droptarget = base.mix(DroptargetEntity(base)),
            // set the initial color to red
            color = 'red',
            // set the font we want to use
            font = new me.Font('Verdana', 15, 'black'),
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
                },
                setText: function (value) {
                    text = value;
                },
                setColor: function (value) {
                    color = value;
                }
            });

        // make the font bold
        font.bold();
        // return the droptarget entity
        return obj;
    };
});

game.droptarget2 = function(x, y, settings) {
    // construct a new droptarget instance
    var obj = game.droptarget(x, y, settings);
    // change the text
    obj.setText('Drop on me\n\nAnd I\'ll turn green\n\ncheckmethod: contains');
    // change the color
    obj.setColor('gold');
    // change the check method
    obj.setCheckMethod(obj.CHECKMETHOD_CONTAINS);
    // return the droptarget2 entity
    return obj;
};
