game.PlayScreen = me.ScreenObject.extend({
    /**
     *  action to perform on state change
     */
    onResetEvent: function() {

        // background color
        me.game.world.addChild(new me.ColorLayer("background", "#330000"), 0);

        // static background image
        var background = new me.Sprite(480, 320, {
            image: game.texture,
            region : "backdrop.png"
        });
        me.game.world.addChild(background, 1);

        // character animation
        var animationSheet = game.texture.createAnimationFromName([
            "slice04_04.png", "slice05_05.png", "slice12_12.png", "slice13_13.png"
        ]);
        animationSheet.pos.set(200, 200, 2);
        me.game.world.addChild(animationSheet, 2);
    }
});
