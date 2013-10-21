game.square = (function (BaseEntity, DraggableEntity) {
    return function (x, y, settings) {
        var base = new BaseEntity(x, y, settings),
            draggable = base.mix(DraggableEntity(base)),
            color = 'white',
            obj = draggable.mix({
                draw: function (context) {
                    context.fillStyle = color;
                    context.fillRect(
                        this.pos.x,
                        this.pos.y,
                        this.width,
                        this.height
                    );
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
        return obj;
    }
}(me.ObjectEntity, me.DraggableEntity));
