game.PlayScreen = me.Stage.extend({
    /**
     *  action to perform on state change
     */
    onResetEvent: function() {
        // clear the background
        me.game.world.addChild(new me.ColorLayer("background", "rgba(248, 194, 40, 1.0)"), 0);

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
        this.font = new me.Text(0, 0 ,{
            font: "Arial",
            size: 10,
            fillStyle: "white",
            textAlign: "center",
            textBaseline: "top",
            text: "(xxx, xxx)"
        });
        me.game.world.addChild(this.font, Infinity);

        // display the current pointer coordinates on top of the pointer arrow
        var self = this;
        me.event.subscribe(me.event.POINTERMOVE, function(event) {
            var x = Math.round(event.gameScreenX);
            var y = Math.round(event.gameScreenY);
            self.font.pos.set(x, y - self.font.height, self.font.pos.z);
            self.font.setText( "( " + x + "," + y + " )");
        });

    }
});
