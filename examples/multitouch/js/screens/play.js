game.PlayScreen = me.ScreenObject.extend({
    /** 
     *  action to perform on state change
     */
    onResetEvent: function() {  
        // clear the background
        me.game.add(new me.ColorLayer('background', '#000000', 0), 0);
        // add a few squares on the finger positions of the left hand
        me.game.add(game.square(100, 400, {width: 100, height: 100}), 1);
        me.game.add(game.square(220, 300, {width: 100, height: 100}), 1);
        me.game.add(game.square(340, 250, {width: 100, height: 100}), 1);
        me.game.add(game.square(460, 310, {width: 100, height: 100}), 1);
        me.game.add(game.square(670, 500, {width: 100, height: 100}), 1);
    }
});
