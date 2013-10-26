/**
 * PlayScreen
 */
game.PlayScreen = me.ScreenObject.extend({
    "init" : function () {
        me.game.viewport.setBounds(1920, 1080);
        this.parent(true);
    },

    /** 
     * action to perform on state change
     */
    "onResetEvent" : function() {  
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

        return true;
    }
});
