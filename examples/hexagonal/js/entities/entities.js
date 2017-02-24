
/************************************************************************************/
/*                                                                                  */
/*        a text entity                                                           */
/*                                                                                  */
/************************************************************************************/
game.TextEntity = me.Renderable.extend({
    init: function (x, y, width, height) {
        var self = this;
        this.text = "?,?";
        this.font_size = 20;
        this.font = new me.Font("courier", this.font_size, "white");

        // call the constructor
        this._super(me.Renderable, "init", [x, y , width, height]);
        this.floating = true;

        this.pointerDown = me.event.subscribe("pointermove", function (event) {
            self.text = "?,?";
            //self.text = Math.round(event.gameX) + "," + Math.round(event.gameY);
            if (me.levelDirector.getCurrentLevelId()) {
                var layer = me.game.world.getChildByName("Ground")[0];
                var tile = layer.getTile(event.gameWorldX, event.gameWorldY);
                if (tile) {
                    self.text = tile.col + "," + tile.row;
                }
            }
        });
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
