/**
 * HUD namespace
 */
game.HUD = game.HUD || {};

/**
 * a very simple virtual joypad and buttons, that triggers
 * corresponding key events
 */
game.HUD.VirtualJoypad = me.Container.extend({

    init: function() {
        // call the constructor
        this._super(me.Container, "init");

        // persistent across level change
        this.isPersistent = true;

        // Use screen coordinates
        this.floating = true;

        // make sure our object is always draw first
        this.z = Infinity;

        // give a name
        this.name = "VirtualJoypad";

        // instance of the virtual joypad
        this.joypad = new game.HUD.Joypad(
            50,
            me.game.viewport.height - 200
        );

        // instance of the button
        this.button = new game.HUD.Button(
            me.game.viewport.width - 150,
            me.game.viewport.height - 150
        );

        this.addChild(this.joypad);
        this.addChild(this.button);

        // re-position the button in case of
        // size/orientation change
        var self = this;
        me.event.subscribe(
            me.event.VIEWPORT_ONRESIZE, function (width, height) {
                self.button.pos.set(
                    width - 150,
                    height - 150,
                    self.button.pos.z
                )
            }
        );

    }
});

/**
 * a basic control to toggle fullscreen on/off
 */
game.HUD.Button = me.GUI_Object.extend({
    /**
     * constructor
     */
    init: function(x, y) {
        this._super(me.GUI_Object, "init", [ x, y, {
            image: game.texture,
            region : "shadedDark36.png"
        } ]);
        this.setOpacity(0.25);
        this.anchorPoint.set(0, 0);
    },

    /**
     * function called when the object is clicked on
     */
    onClick : function (event) {
        this.setOpacity(0.5);
        me.input.triggerKeyEvent(me.input.KEY.SPACE, true);
        return false;
    },

    /**
     * function called when the object is clicked on
     */
    onRelease : function (event) {
        this.setOpacity(0.25);
        me.input.triggerKeyEvent(me.input.KEY.SPACE, false);
        return false;
    }
});


/**
 * our virtual joypad
 */
game.HUD.Joypad = me.GUI_Object.extend({
    /**
     * constructor
     */
    init: function(x, y) {
        this._super(me.GUI_Object, "init", [ x, y, {
            // background "fix" part of the joypad
            image: game.texture,
            region : "shadedDark07.png",
            anchorPoint : new me.Vector2d(0, 0)
        } ]);

        // mobile part of the joypad
        this.pad = new me.Sprite(x, y, {
            image: game.texture,
            region : "shadedDark01.png",
            anchorPoint : new me.Vector2d(0, 0)
        });

        // default relative position from the back of the joypad
        this.relative = new me.Vector2d(
            this.width / 2 - this.pad.width / 2,
            this.height / 2 - this.pad.height /2
        );

        // offset by which the joypad move when pressed/moved
        this.joypad_offset = new me.Vector2d();

        // default opacity
        this.setOpacity(0.25);

        // cursors status
        // TODO make it configurable
        this.cursors = {
            up: false,
            down: false,
            left: false,
            right: false
        };

        // register on the pointermove event
        me.input.registerPointerEvent('pointermove', this, this.pointerMove.bind(this));
    },

    onDestroyEvent: function () {
        // release register event event
        me.input.releasePointerEvent("pointermove", this);
    },

    /**
     * pointermove function
     */
    pointerMove: function (event) {
        if (this.released === false) {
            var x = event.gameScreenX + (event.width / 2);
            var y = event.gameScreenY + (event.height / 2);
            // pointerMove is a global on the viewport, so check for coordinates
            if (this.getBounds().containsPoint(x, y)) {
                // if any direction is active, update it if necessary
                if (this.cursors.left === true || this.cursors.right === true) {
                    this.checkDirection.call(this, x, y);
                }
            } else {
                // release keys/joypad if necessary
                this.onRelease.call(this, event);
            }
        }
    },

    // update the cursors value and trigger key event
    checkDirection : function (x, y) {
        if (x - this.pos.x < this.width / 2) {
            if (this.cursors.left === false) {
                me.input.triggerKeyEvent(me.input.KEY.LEFT, true);
                this.cursors.left = true;
                this.joypad_offset.x = -((this.width / 2 - (x - this.pos.x)) % this.pad.width / 4);
            }
            // release the right key if it was pressed
            if (this.cursors.right === true) {
                me.input.triggerKeyEvent(me.input.KEY.RIGHT, false);
                this.cursors.right = false;
            }
        }
        if (x - this.pos.x > this.width / 2) {
            if (this.cursors.right === false) {
                me.input.triggerKeyEvent(me.input.KEY.RIGHT, true);
                this.cursors.right = true;
                this.joypad_offset.x = +(((x - this.pos.x) - this.width / 2) % this.pad.width / 4);
            }
            // release the left key is it was pressed
            if (this.cursors.left === true) {
                me.input.triggerKeyEvent(me.input.KEY.LEFT, false);
                this.cursors.left = false;
            }
        }
    },

    /**
     * function called when the object is clicked on
     */
    onClick : function (event) {
        var x = event.gameScreenX + (event.width / 2);
        var y = event.gameScreenY + (event.height / 2);
        this.setOpacity(0.50);
        this.checkDirection.call(this, x, y);
        return false;
    },

    /**
     * function called when the object is release or cancelled
     */
    onRelease : function (event) {
        this.setOpacity(0.25);
        if (this.cursors.left === true) {
            me.input.triggerKeyEvent(me.input.KEY.LEFT, false);
            this.cursors.left = false;
        }
        if (this.cursors.right === true) {
            me.input.triggerKeyEvent(me.input.KEY.RIGHT, false);
            this.cursors.right = false;
        }
        this.joypad_offset.set(0, 0);
        return false;
    },

    /**
     * extend the draw function
     */
    draw : function (renderer) {
        // call the super constructor
        this._super(me.GUI_Object, "draw", [ renderer ]);
        this.pad.pos.setV(this.pos).add(this.relative).add(this.joypad_offset);
        this.pad.draw(renderer);
    }
});
