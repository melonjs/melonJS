game.PlayScreen = me.ScreenObject.extend({
    /**
     *  action to perform on state change
     */
    onResetEvent: function() {
        // clear the background
        me.game.world.addChild(new me.ColorLayer("background", "rgba(248, 194, 40, 255)"), 0);

        // add the UI elements
        var panel = new game.UI.Container(150, 100, 450, 325, "OPTIONS");

        // add a few checkbox
        panel.addChild(new game.UI.CheckBoxUI(
            125, 75,
            game.texture,
            "green_boxCheckmark",
            "grey_boxCheckmark",
            "Music ON", // default
            "Music OFF"
        ));
        panel.addChild(new game.UI.CheckBoxUI(
            125, 125,
            game.texture,
            "green_boxCheckmark",
            "grey_boxCheckmark",
            "Sound FX ON", // default
            "Sound FX OFF"
        ));

        // a few buttons
        panel.addChild(new game.UI.ButtonUI(
            125, 175,
            "blue",
            "Video Options"
        ));
        panel.addChild(new game.UI.ButtonUI(
            30, 250,
            "green",
            "Accept"
        ));
        panel.addChild(new game.UI.ButtonUI(
            230, 250,
            "yellow",
            "Cancel"
        ));

        // add the panel to word (root) container
        me.game.world.addChild(panel, 1);

        // display the current pointer coordinates on top of the pointer arrow
        me.game.world.addChild(new (me.Renderable.extend({
            init: function() {
                this._super(me.Renderable, 'init', [0, 0, 10, 10]);
                this.font = new me.Font("Arial", 10, "#FFFFFF");
                this.font.textAlign = "center";
                this.fontHeight = this.font.measureText(me.video.renderer, "DUMMY").height;
            },
            draw: function(renderer){
                var x = Math.round(me.input.pointer.pos.x);
                var y = Math.round(me.input.pointer.pos.y);
                this.font.draw (
                    renderer,
                    "( " + x + "," + y + " )",
                    x,
                    y - this.fontHeight);
            }
        })), 10);
    }
});
