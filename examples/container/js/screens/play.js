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
            "background",
            1024,
            768,
            "background",
            0,
            1
        ));
        me.game.world.addChild(new game.Entity(250, 100, {
            "width" : 50,
            "height" : 50,
            "color" : "red"
        }));
        me.game.world.addChild(new game.FloatingEntity(275, 125, {
            "width" : 50,
            "height" : 50,
            "color" : "blue"
        }));

        me.input.bindKey(me.input.KEY.LEFT, "left");
        me.input.bindKey(me.input.KEY.RIGHT, "right");
        me.input.bindKey(me.input.KEY.UP, "up");
        me.input.bindKey(me.input.KEY.DOWN, "down");
    }
});
