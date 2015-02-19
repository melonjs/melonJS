/**
 * PlayScreen
 */
game.PlayScreen = me.ScreenObject.extend({

    /**
     * action to perform on state change
     */
    "onResetEvent" : function() {
        // update the camera bounds
        me.game.viewport.setBounds(0, 0, 1920, 1080);

        me.game.world.addChild(new me.ImageLayer(
            0,
            0,
            {
                width: game.WORLD_WIDTH,
                height: game.WORLD_HEIGHT,
                image: "background",
                z: 0
            }
        ));

        var myContainer = new (me.Container.extend({
            init: function () {
                this._super(me.Container, "init", [0, 0, 100, 100]);
            },
            draw: function (renderer) {
                this._super(me.Container, "draw", [renderer]);
                renderer.setColor('#ff0000');
                renderer.strokeRect(this.pos.x, this.pos.y, this.getBounds().width, this.getBounds().height);
                renderer.setColor('#ffff00');
                renderer.strokeRect(this.pos.x, this.pos.y, this._absoluteBounds.width, this._absoluteBounds.height);
            }
        }));
        myContainer.floating = true;
        var floatingEntity = new game.Entity(275, 125, {
            "width" : 50,
            "height" : 50,
            "color" : "blue",
            "moveControls" : true
        });
        floatingEntity.floating = true;
        myContainer.addChild(floatingEntity);
        me.game.world.addChild(myContainer);

        me.game.world.addChild(new game.Entity(250, 100, {
            "width" : 50,
            "height" : 50,
            "color" : "red"
        }));


        me.input.bindKey(me.input.KEY.LEFT, "left");
        me.input.bindKey(me.input.KEY.RIGHT, "right");
        me.input.bindKey(me.input.KEY.UP, "up");
        me.input.bindKey(me.input.KEY.DOWN, "down");
    }
});
