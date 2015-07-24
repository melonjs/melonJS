game.PlayScreen = me.ScreenObject.extend({
    /**
     *  action to perform on state change
     */
    onResetEvent: function() {
        me.game.world.addChild(new me.ColorLayer("background", "#330000", 0));
        me.game.world.addChild(game.texture.createSpriteFromName("backdrop.png"), 1);
        var animationSheet = game.texture.createAnimationFromName([
            "slice04_04.png", "slice05_05.png", "slice12_12.png", "slice13_13.png"
        ]);

        animationSheet.pos.x = 200;
        animationSheet.pos.y = 200;
        me.game.world.addChild(animationSheet, 2);
    },

    /**
     *  action to perform when leaving this screen (state change)
     */
    onDestroyEvent: function() {
        me.device.unwatchDeviceOrientation();
        me.device.unwatchAccelerometer();
    }
});
