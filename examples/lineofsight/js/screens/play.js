game.PlayScreen = me.Stage.extend({
    /**
     *  action to perform on state change
     */
    onResetEvent: function() {
        var rectSize = 150;

        // clear the background
        me.game.world.addChild(new me.ColorLayer("background", "black"), 0);

        // add a few shapes
        me.game.world.addChild(new game.Square(50, 50, {width: rectSize, height: rectSize}), 1);
        me.game.world.addChild(new game.Square(50, 400, {width: rectSize, height: rectSize}), 1);
        me.game.world.addChild(new game.Square(300, 125, {width: rectSize, height: rectSize}), 1);
        me.game.world.addChild(new game.Square(300, 350, {width: rectSize, height: rectSize}), 1);
        me.game.world.addChild(new game.Square(600, 200, {width: rectSize, height: rectSize}), 1);
        me.game.world.addChild(new game.Square(600, 400, {width: rectSize, height: rectSize}), 1);

        me.game.repaint();

        // display the current pointer coordinates on top of the pointer arrow
        // and some helper text at the bottom of the viewport
        me.game.world.addChild(new (me.Renderable.extend({
            init: function() {
                this._super(me.Renderable, 'init', [0, 0, 10, 10]);
                this.font = new me.Text(0, 0, {
                    font: "Arial",
                    fillStyle : "#FFFFFF",
                    size: 10,
                    textAlign : "center",
                    textBaseline : "bottom"
                });
            },
            update : function (dt) {
                return true;
            },
            draw: function(renderer) {
                var x = Math.round(me.input.pointer.gameWorldX);
                var y = Math.round(me.input.pointer.gameWorldY);

                // cursor coordinates
                this.font.draw(renderer, "( " + x + "," + y + " )", x, y);

                this.font.draw(
                    renderer,
                    "drag the square to check for intersection witht the line",
                    150,
                    me.game.viewport.height
                );
            }
        })), 10);

        // basic renderable that cast a ray across the world
        me.game.world.addChild(new (me.Renderable.extend({
            init: function() {
                this._super(me.Renderable, 'init', [0, 0, 10, 10]);
                this.line = new me.Line(me.game.viewport.width / 2, me.game.viewport.height / 2, [
                    new me.Vector2d(0, 0),
                    new me.Vector2d(me.game.viewport.width / 2, me.game.viewport.height / 2)
                ]);

            },
            update : function (dt) {
                this.line.rotate(0.0125);
                var result = me.collision.rayCast(this.line);

                if (result.length > 0) {
                    for (var i = 0; i < result.length; i++) {
                        // update the object isColliding flag
                        result[i].isColliding = true;
                    }
                }
                return true;
            },
            draw: function(renderer) {
                renderer.setColor("red");
                renderer.stroke(this.line);
            }
        })), 10);
    }
});
