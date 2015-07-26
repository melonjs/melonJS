game.PlayScreen = me.ScreenObject.extend({
    /**
     * action to perform on state change
     */
    onResetEvent : function() {
        // set world size
        me.game.viewport.bounds.resize(2000, 2000);

        // add background to the game world
        me.game.world.addChild(new me.ImageLayer(0, 0, {image:"grid", z:1}));

        var leftContainer = document.querySelector("#leftPanel .controls");
        var rightContainer = document.querySelector("#rightPanel .controls");
        var controller = game.EmitterController = new game.ParticleEditor.EmitterController(rightContainer);
        var emitterList = game.EmitterList = new game.ParticleEditor.EmitterList(controller, leftContainer);
        game.CodeGenerator = new game.ParticleEditor.CodeGenerator(controller, leftContainer);

        // start the default emitter example
        game.changeEmitter();

        // enable the keyboard
        me.input.bindKey(me.input.KEY.X, "moveEmitter", false, false);
        me.input.bindKey(me.input.KEY.C, "moveViewport", false, false);

        // map the left button click on the enter key
        me.input.bindPointer(me.input.pointer.LEFT, me.input.KEY.X);
        me.input.bindPointer(me.input.pointer.MIDDLE, me.input.KEY.C);

        // flush cached html layout after we added the editor elements
        me.video.onresize();

        // listen to mouse movement
        var viewport = me.game.viewport;
        var mousepos = me.input.pointer.pos;
        var lastX = mousepos.x, lastY = mousepos.y;
        me.event.subscribe(me.event.MOUSEMOVE, function() {
            if (me.input.isKeyPressed("moveEmitter")) {
                var pos;
                for ( var emitters = emitterList.emitters, i = emitters.length, obj; i--, (obj = emitters[i]);) {
                    if (!obj.floating) {
                        pos = viewport.localToWorld(mousepos.x, mousepos.y);
                    } else {
                        pos = mousepos;
                    }
                    obj.pos.x = pos.x - obj.width / 2;
                    obj.pos.y = pos.y - obj.height / 2;
                }

                me.event.publish("propertyChanged", [ game.EmitterController.emitter ]);
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
