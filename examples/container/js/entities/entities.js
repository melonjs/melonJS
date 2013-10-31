/**
 * a renderable for my entity
 */
game.Rect = me.Renderable.extend({
    "init" : function (pos, w, h, color) {
        this.parent(pos, w, h);
        this.z = 0;
        this.color = color;
    },
    
    "draw" : function(context) {
        context.fillStyle = this.color;
        context.fillRect(this.pos.x, this.pos.y, this.width, this.height);
    }
});

/**
 * a basic entity
 */
game.Entity = me.ObjectEntity.extend({
    "init" : function (x, y, settings) {
        this.parent(x, y, settings);
        this.z = 1;
        this.renderable = new me.ObjectContainer(0, 0, 50, 50);
        this.renderable.addChild(new game.Rect(
            new me.Vector2d(),
            50,
            50,
            settings.color
        ));
    }
});

/**
 * a floating entity
 */
game.FloatingEntity = me.ObjectEntity.extend({
    "init" : function (x, y, settings) {
        this.parent(x, y, settings);
        this.z = 1;
        this.floating = true;
        this.renderable = new me.ObjectContainer(0, 0, 50, 50);

        var container = new me.ObjectContainer(0, 0, 50, 50);
        container.addChild(new game.Rect(
            new me.Vector2d(),
            50,
            50,
            settings.color
        ));
        this.renderable.addChild(container);
    }
});
