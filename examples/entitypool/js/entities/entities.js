game.Background = me.Renderable.extend({
    init : function() {
        this._super(me.Renderable, "init", [0, 0, me.game.viewport.width, me.game.viewport.height]);
        this.z = 1;
    },
    draw : function(renderer) {
        renderer.clearColor("#000");
    }
});

game.MainEntity = me.Entity.extend({
    init : function(x, y) {
        var settings = {
            image : "basicImage",
            framewidth : 32,
            frameheight : 32,
            width : 32,
            height : 32
        };
        this._super(me.Entity, "init", [x, y, settings]);
        this.z = 2;
        this.renderable.addAnimation("idle", [0], 1);
        this.renderable.setCurrentAnimation("idle");
    },

    update: function(delta) {
        this._super(me.Entity, "update", [delta]);
    }
});

game.RenderableEntity = me.Renderable.extend({
    init : function(x, y) {
        this._super(me.Renderable, "init", [x, y, 100, 100]);
        this.z = 2;
    },

    draw : function(renderer) {
        renderer.save();
        renderer.setColor("#fff");
        renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
        renderer.restore();
    }
});
