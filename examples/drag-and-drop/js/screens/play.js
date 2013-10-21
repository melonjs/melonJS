game.PlayScreen = me.ScreenObject.extend({
    /** 
     *  action to perform on state change
     */
    onResetEvent: function() {  
        // clear the background
        me.game.add(new me.ColorLayer("background", "#000000", 0), 0);
        // add a few squares
        me.game.add(game.square(200, 50, {width: 100, height: 100}), 1);
        me.game.add(game.square(200, 250, {width: 100, height: 100}), 1);
        me.game.add(game.square(200, 450, {width: 100, height: 100}), 1);

        // add a droptarget entity
        me.game.add(game.droptarget(400, 20, {width: 200, height: 150}), 1);

        // add another droptarget entity
        me.game.add(game.droptarget2(400, 220, {width: 200, height: 150}), 1);

        // add another droptarget entity
        me.game.add(game.droptarget3(400, 420, {width: 200, height: 150}), 1);
    }
});
