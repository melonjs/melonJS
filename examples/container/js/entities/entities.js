/**
 * a renderable for my entity
 */
game.Rect = me.Renderable.extend({
    "init" : function (x, y, w, h, color) {
        this._super(me.Renderable, "init", [x, y, w, h]);
        this.z = 0;
        this.color = color;
    },

    "draw" : function(renderer) {
        renderer.setColor(this.color);
        renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
    }
});

/**
 * a basic entity
 */
game.Entity = me.Entity.extend({
    "init" : function (x, y, settings) {
        this._super(me.Entity, "init", [x, y, settings]);
        this.z = 1;
        this.renderable = new me.Container(0, 0, 50, 50);
        this.renderable.addChild(new game.Rect(
            0, 0,
            50,
            50,
            settings.color
        ));
    }
});

/**
 * a floating entity
 */
game.FloatingEntity = me.Entity.extend({
    "init" : function (x, y, settings) {
        this._super(me.Entity, "init", [x, y, settings]);
        this.z = 1;
        this.floating = true;
        this.renderable = new me.Container(0, 0, 50, 50);
        this.renderable.addChild(new game.Rect(
            0, 0,
            50,
            50,
            settings.color
        ));
    },

    /**
     * action to perform on frame update
     */
    "update" : function () {
        var vp = me.game.viewport;
        if (me.input.isKeyPressed("left")) {
            vp.move(5, 0);
        }
        else if (me.input.isKeyPressed("right")) {
            vp.move(-5, 0);
        }
        if (me.input.isKeyPressed("up")) {
            vp.move(0, 5);
        }
        else if (me.input.isKeyPressed("down")) {
            vp.move(0, -5);
        }

        this._super(me.Entity, "update");
        return true;
    }
});
