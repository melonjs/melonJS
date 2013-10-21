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
            // to hold the text we want to display
            text = settings.text || '',
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
                    color = 'red';
                },
                dragEnd: function () {
                    color = 'white';
                }
            });
        // return the square object
        return obj;
    };
});
