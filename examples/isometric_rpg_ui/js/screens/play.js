game.PlayScreen = me.ScreenObject.extend({
    /**
     *  action to perform on state change
     */
    onResetEvent: function() {

        // disable gravity
        me.sys.gravity = 0;

        // load a level
        me.levelDirector.loadLevel("isometric");

        // display a basic tile selector -- removed

        // register on mouse event -- removed

        // add the UI elements
        //this.panel = new game.UI.Container(150, 100, 450, 325, "TEST OPTIONS");
        this.panel = me.pool.pull("UIContainer", 150, 100, 450, 325, "TEST OPTIONS");

        // add a few checkbox
        //this.panel.addChild(new game.UI.CheckBoxUI(
        this.panel.addChild(me.pool.pull("UICheckBox",
            125, 75,
            game.texture,
            "green_boxCheckmark",
            "grey_boxCheckmark",
            "Music ON", // default
            "Music OFF"
        ));
        //this.panel.addChild(new game.UI.CheckBoxUI(
        this.panel.addChild(me.pool.pull("UICheckBox",
            125, 125,
            game.texture,
            "green_boxCheckmark",
            "grey_boxCheckmark",
            "Sound FX ON", // default
            "Sound FX OFF"
        ));

        // a few buttons
        //this.panel.addChild(new game.UI.ButtonUI(
        this.panel.addChild(me.pool.pull("UIButton",
            125, 175,
            "blue",
            "Video Options",
            this.videoOptionClick.bind(this)
        ));
        //this.panel.addChild(new game.UI.ButtonUI(
        this.panel.addChild(me.pool.pull("UIButton",
            30, 250,
            "green",
            "Accept",
            this.acceptClick.bind(this)
        ));
        //this.panel.addChild(new game.UI.ButtonUI(
        this.panel.addChild(me.pool.pull("UIButton",
            230, 250,
            "yellow",
            "Cancel",
            this.cancelClick.bind(this)
        ));

        // add the panel to word (root) container
        me.game.world.addChild(this.panel, 10);

    },

    /**
     *  action to perform on state change
     */
    onDestroyEvent: function() {
        // unsubscribe to all events
        //me.event.unsubscribe(this.pointerEvent);
        //me.event.unsubscribe(this.viewportEvent);
        //me.input.releasePointerEvent("pointermove", me.game.viewport);
    },

    // button callback
    videoOptionClick:function(){
    	console.log("play: videoOptionClick:");
    },

    // button callback
    acceptClick:function(){
    	console.log("play: acceptClick:");
      me.game.world.removeChild(this.panel);
      // me.game.world.removeChild(this.pointer);
      me.game.repaint();
    },

    // button callback
    cancelClick:function(){
    	console.log("play: cancelClick:");
      me.game.world.removeChild(this.panel);
      // me.game.world.removeChild(this.pointer);
      me.game.repaint();
    }
});
