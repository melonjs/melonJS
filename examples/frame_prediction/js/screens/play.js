game.PlayScreen = me.ScreenObject.extend({
    /**
     *  action to perform on state change
     */
    onResetEvent: function() {
      // load a level
        me.levelDirector.loadLevel("room");

    },

    /**
     *  action to perform on state change
     */
    onDestroyEvent: function() {

    }
});
