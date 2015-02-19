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
        this.renderable = new game.Rect(
            0, 0,
            50,
            50,
            settings.color
        );
        this.moveControls = settings.moveControls;
        this.name = settings.color;

        this.followTarget = new me.Vector2d(x, y);
        me.game.viewport.follow(this.followTarget, me.game.viewport.AXIS.BOTH);
    },

    "update" : function (dt) {
        this._super(me.Entity, "update", [dt]);
        if (me.input.isKeyPressed("up")) {
            this.followTarget.y -= 5;
        }

        if (me.input.isKeyPressed("down")) {
            this.followTarget.y += 5;
        }

        if (me.input.isKeyPressed("left")) {
            this.followTarget.x -= 5;
        }

        if (me.input.isKeyPressed("right")) {
            this.followTarget.x += 5;
        }

        this.followTarget.x.clamp(0, game.WORLD_WIDTH - 50);
        this.followTarget.y.clamp(0, game.WORLD_HEIGHT - 50);
    }
});