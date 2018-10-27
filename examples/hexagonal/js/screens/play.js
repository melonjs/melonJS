game.PlayScreen = me.Stage.extend({
    /**
     *  action to perform on state change
     */
    onResetEvent: function() {
        // load a level
        me.levelDirector.loadLevel("hexagonal-mini");

        // add the Text Entity that display pointer coordinates
        me.game.world.addChild(new game.TextEntity(0,0,100,20));
    },

    /**
     *  action to perform on state change
     */
    onDestroyEvent: function() {
    }
});
