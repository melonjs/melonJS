
var game = {

    /**
     * Initialize the application
     */
     onload: function() {

        // Initialize the video.
        if (!me.video.init(640, 480, {wrapper : "screen", scale : "auto"})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // set all ressources to be loaded
        me.loader.preload([{name: "atascii", type:"image", src: "atascii_8px.png"}], this.loaded.bind(this));
    },

    /**
     * callback when everything is loaded
     */
    loaded: function () {
        var PlayScreen = me.ScreenObject.extend({
            // on reset event function
            onResetEvent : function() {
                // black background
                me.game.world.addChild(new me.ColorLayer("background", "#202020"), 0);
                // the font stuff
                me.game.world.addChild(new FontTest(), 1);
            }
        });

        // set the "Play/Ingame" Screen Object
        me.state.set(me.state.PLAY, new PlayScreen());
        // switch to PLAY state
        me.state.change(me.state.PLAY);
    }

}; // game


// the font test renderables object
var FontTest = me.Renderable.extend ({

    // constructor
    init: function() {
        this._super(me.Renderable, "init", [0, 0, me.video.renderer.getWidth(), me.video.renderer.getHeight()]);

        // a default white color object
        this.color = me.pool.pull("me.Color", 255, 255, 255);

        // define a tween to cycle the font color
        this.tween = new me.Tween(this.color)
            .to({
                g : 0,
                b : 0
            }, 2000)
            .repeat( Infinity )
            .yoyo(true)
            .start();

        // arial font
        this.font = new me.Font("Arial", 8, this.color);
        // bitmap font
        this.bFont = new me.BitmapFont("atascii", {x:8});
    },

    // draw function
    draw : function(renderer) {
        var i = 0;
        var text = "";
        var baseline = 0;
        var x_pos = 0;
        var y_pos = 0;

        // font size test
        this.font.textAlign = "left";
        this.font.lineWidth = "2";
        this.font.setOpacity (0.5);
        for (i = 8; i < 48; i += 8) {
            this.font.setFont("Arial", i, this.color);
            this.font.draw(renderer, "Arial Text " + i + "px !" , 5 , y_pos );
            y_pos += this.font.measureText(renderer, "DUMMY").height;
        }
        // one more with drawStroke this time
        this.font.setFont("Arial", 48, this.color);
        this.font.strokeStyle.parseCSS("red");
        this.font.lineWidth = 3;
        this.font.drawStroke(renderer, "Arial Text " + i + "px !" , 5 , y_pos );

        // bFont size test
        y_pos = 0;
        this.bFont.textAlign = "right";
        for (i = 1; i < 5; i++) {
            this.bFont.setOpacity (0.2 * i);
            this.bFont.resize(i);
            this.bFont.draw(renderer, "BITMAP TEST" , me.video.renderer.getWidth() , y_pos );
            y_pos += this.bFont.measureText(renderer, "DUMMY").height;
        }

        this.font.setOpacity(1);
        this.bFont.setOpacity(1);

        // font baseline test
        this.font.setFont("Arial", 16, "white");
        baseline = 200;

        // Draw the baseline
        me.video.renderer.setColor("red");
        me.video.renderer.strokeLine(
            0, baseline + 0.5,
            me.video.renderer.getWidth(), baseline + 0.5
        );

        var baselines = [
            "bottom", "ideographic", "alphabetic", "middle", "hanging", "top"
        ];

        // font baseline test
        me.video.renderer.setColor("white");
        for (i = 0; i < baselines.length; i++) {
            text = baselines[i];
            this.font.textBaseline = baselines[i];
            this.font.draw(renderer, text, x_pos, baseline);
            x_pos += this.font.measureText(renderer, text + "@@@").width;
        }

        // restore default baseline
        this.font.textBaseline = "top";

        // ---- multiline testing -----

        // font text
        text = "this is a multiline font\n test with melonjs and it\nworks even with a\n specific lineHeight value!";
        this.font.textAlign = "center";
        this.font.lineHeight = 1.1;
        this.font.draw(renderer, text, 90, 210);
        this.font.lineHeight = 1.1;

        text = "this is another font test \nwith right alignment\nand it still works!";
        this.font.textAlign = "right";
        this.font.draw(renderer, text, 200, 300);

        // bFont  test
        this.bFont.textAlign = "center";
        text = "THIS IS A MULTILINE\n BITMAP FONT WITH MELONJS\nAND IT WORKS";
        this.bFont.resize(2);
        this.bFont.draw(renderer, text + "\n" + text, 400, 230);

        // bFont  test
        this.bFont.textAlign = "right";
        text = "ANOTHER FANCY MULTILINE\n BITMAP FONT WITH MELONJS\nAND IT STILL WORKS";
        this.bFont.lineHeight = 1.2;
        this.bFont.resize(3);
        this.bFont.draw(renderer, text, 640, 400);
        this.bFont.lineHeight = 1.0;

        // baseline test with bitmap font
        x_pos = 0;
        this.bFont.textAlign = "left";
        this.bFont.resize(1);
        baseline = 375;

        // Draw the baseline
        me.video.renderer.setColor("red");
        me.video.renderer.strokeLine(
            0, baseline + 0.5,
            me.video.renderer.getWidth(), baseline + 0.5
        );

        // font baseline test
        me.video.renderer.setColor("white");
        for (i = 0; i < baselines.length; i++) {
            text = baselines[i].toUpperCase();
            this.bFont.textBaseline = baselines[i];
            this.bFont.draw(renderer, text, x_pos, baseline);
            x_pos += this.bFont.measureText(renderer, text + "@@@").width + 8;
        }

        // restore default alignement/baseline
        this.font.textAlign = "left";
        this.font.textBaseline = "top";
        this.bFont.textAlign = "left";
        this.bFont.textBaseline = "top";
    },

    onDeactivateEvent: function() {
        me.pool.push(this.color);
    }
});
