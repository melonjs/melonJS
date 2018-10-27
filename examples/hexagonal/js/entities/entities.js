/**
 *  a text entity to display mouse coords
 */
game.TextEntity = me.Renderable.extend({
    init: function (x, y, width, height) {
        this.text = "?,?";
        this.font_size = 20;
        this.font = new me.Font("courier", this.font_size, "white");

        // call the constructor
        this._super(me.Renderable, "init", [x, y , width, height]);

        this.anchorPoint.set(0, 0);
        this.floating = true;

        this.isKinematic = false;
    },

    onActivateEvent: function () {
        var self = this;
        // register on mouse event
        me.input.registerPointerEvent("pointermove", me.game.viewport, function (event) {
            self.text = "?,?";
            var layer = me.game.world.getChildByName("Ground")[0];
            var tile = layer.getTile(event.gameWorldX, event.gameWorldY);
            if (tile) {
                self.text = tile.col + "," + tile.row;
            }
        }, false);
    },

    draw : function (renderer) {
        renderer.setColor("black");
        renderer.fillRect(
            this.left,  this.top,
            this.width, this.height
        );
        this.font.draw(renderer,this.text,this.pos.x, this.pos.y);
    },

    update : function () {
        return true;
    },
});
