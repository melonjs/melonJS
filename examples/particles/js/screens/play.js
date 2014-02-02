game.PlayScreen = me.ScreenObject.extend({
    /**
     * action to perform on state change
     */
    onResetEvent : function() {
        // set world size
        me.game.viewport.bounds.resize(2000, 2000);

        // add background to the game world
        me.game.world.addChild(new me.ImageLayer("background", 0, 0, "grid", 0, 0));

        var controller = game.EmitterController = new game.ParticleEditor.EmitterController(game.Emitter, "emitterControls");
        var emitterList = game.EmitterList = new game.ParticleEditor.EmitterList(controller, "emitterList");

        // start the default emitter example
        game.changeEmitter();

        // enable the keyboard
        me.input.bindKey(me.input.KEY.X, "moveEmitter");
        me.input.bindKey(me.input.KEY.C, "moveViewport");

        // map the left button click on the enter key
        me.input.bindMouse(me.input.mouse.LEFT, me.input.KEY.X);
        me.input.bindMouse(me.input.mouse.MIDDLE, me.input.KEY.C);

        // listen to mouse movement
        var viewport = me.game.viewport;
        var mousepos = me.input.mouse.pos;
        var lastX = mousepos.x, lastY = mousepos.y;
        me.event.subscribe(me.event.MOUSEMOVE, function() {
            if (me.input.isKeyPressed("moveEmitter")) {
                var pos = mousepos;
                if (!game.Emitter.floating) {
                    pos = viewport.localToWorld(pos.x, pos.y);
                }
                for ( var emitters = emitterList.emitters, i = emitters.length, obj; i--, obj = emitters[i];) {
                    obj.pos.setV(pos);
                }
            }
            if (me.input.isKeyPressed("moveViewport")) {
                viewport.move(lastX - mousepos.x, lastY - mousepos.y);
            }
            lastX = mousepos.x;
            lastY = mousepos.y;
        });
    },

    /**
     * action to perform when leaving this screen (state change)
     */
    onDestroyEvent : function() {
        // remove the emitters from the game world
        game.EmitterList.clear();
    }
});
