game.PlayScreen = me.ScreenObject.extend({
    /** 
     *  action to perform on state change
     */
    onResetEvent: function() {  
        // clear the background
        me.game.world.addChild(new me.ColorLayer("background", "#5E3F66", 0), 0);
        
        // add a few shapes
        me.game.world.addChild(new game.Square(50, 100, {width: 120, height: 150}), 1);
        me.game.world.addChild(new game.Circle(250, 300, {width: 150, height: 150}), 1);
        me.game.world.addChild(new game.Poly(600, 150, {width: 200, height: 200}), 1);

        // register on the mousemove event
        me.input.registerPointerEvent("pointermove", me.game.viewport, function (event) {
            me.event.publish("pointermove", [ event ]);
        });
    }
});
