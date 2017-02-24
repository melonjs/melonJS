/**
 * a mole entity
 * note : we don"t use EntityObject, since we wont" use regular collision, etc..
 */
game.MoleEntity = me.Sprite.extend(
{
    init:function (x, y) {
        // call the constructor
        this._super(me.Sprite, "init", [x, y , { image: me.loader.getImage("mole"), framewidth: 178, frameheight: 140}]);

        // idle animation
        this.addAnimation ("idle",  [0]);
        // laugh animation
        this.addAnimation ("laugh",  [1,2,3,2,3,1]);
        // touch animation
        this.addAnimation ("touch",  [4,5,6,4,5,6]);

        // set default one
        this.setCurrentAnimation("idle");

        // use top left coordinates for positioning
        this.anchorPoint.set(0, 0);

        // means fully hidden in the hole
        this.isVisible = false;
        this.isOut = false;
        this.timer = 0;

        this.initialPos = this.pos.y;

        // tween to display/hide the moles
        this.displayTween = null;
        this.hideTween = null;

        // register on mouse event
        me.input.registerPointerEvent("pointerdown", this, this.onMouseDown.bind(this));

    },


    /**
     * callback for mouse click
     */
    onMouseDown : function() {
        if (this.isOut === true) {
            this.isOut = false;
            // set touch animation
            this.setCurrentAnimation("touch", this.hide.bind(this));
            // make it flicker
            this.flicker(750);
            // play ow FX
            me.audio.play("ow");

            // add some points
            game.data.score += 100;

            if (game.data.hiscore < game.data.score) {
                // i could save direclty to me.save
                // but that allows me to only have one
                // simple HUD Score Object
                game.data.hiscore = game.data.score;
                // save to local storage
                me.save.hiscore = game.data.hiscore;
            }

            // stop propagating the event
            return false;

        }
    },


    /**
     * display the mole
     * goes out of the hole
     */
    display : function() {
        var finalpos = this.initialPos - 140;
        this.displayTween = me.pool.pull("me.Tween", this.pos).to({y: finalpos }, 200);
        this.displayTween.easing(me.Tween.Easing.Quadratic.Out);
        this.displayTween.onComplete(this.onDisplayed.bind(this));
        this.displayTween.start();
        // the mole is visible
        this.isVisible = true;
    },

    /**
     * callback when fully visible
     */
    onDisplayed : function() {
        this.isOut = true;
        this.timer = 0;
    },

    /**
     * hide the mole
     * goes into the hole
     */
    hide : function() {
        var finalpos = this.initialPos;
        this.displayTween = me.pool.pull("me.Tween", this.pos).to({y: finalpos }, 200);
        this.displayTween.easing(me.Tween.Easing.Quadratic.In);
        this.displayTween.onComplete(this.onHidden.bind(this));
        this.displayTween.start();
    },

    /**
     * callback when fully visible
     */
    onHidden : function() {
        this.isVisible = false;
        // set default one
        this.setCurrentAnimation("idle");
    },


    /**
     * update the mole
     */
    update : function ( dt )
    {
        if (this.isVisible) {
            // call the super function to manage animation
            this._super(me.AnimationSheet, "update", [dt] );

            // hide the mode after 1/2 sec
            if (this.isOut===true) {
                this.timer += dt;
                if ((this.timer) >= 500) {
                    this.isOut = false;
                    // set default one
                    this.setCurrentAnimation("laugh");
                    this.hide();
                    // play laugh FX
                    //me.audio.play("laugh");

                    // decrease score by 25 pts
                    game.data.score -= 25;
                    if (game.data.score < 0) {
                        game.data.score = 0;

                    }
                }
                return true;
            }
        }
        return this.isVisible;
    }
});

/**
 * a mole manager (to manage movement, etc..)
 */
game.MoleManager = me.Entity.extend(
{
    init: function ()
    {
        var i = 0;
        this.moles = [];

        this.timer = 0;
        var settings = {};
        settings.width = 10;
        settings.height = 10;
        // call the super constructor
        this._super(me.Entity, "init", [0, 0, settings]);

        // add the first row of moles
        for (i = 0; i < 3; i ++) {
            this.moles[i] = new game.MoleEntity((112 + (i * 310)), 127+40);
            me.game.world.addChild (this.moles[i], 15);
        }

        // add the 2nd row of moles
        for (i = 3; i < 6; i ++) {
            this.moles[i] = new game.MoleEntity((112 + ((i-3) * 310)), 383+40);
            me.game.world.addChild (this.moles[i], 35);
        }

        // add the 3rd row of moles
        for (i = 6; i < 9; i ++) {
            this.moles[i] = new game.MoleEntity((112 + ((i-6) * 310)), 639+40);
            me.game.world.addChild (this.moles[i], 55);
        }

        this.timer = 0;

    },

    /*
     * update function
     */
    update : function ( dt )
    {
        // every 1/2 seconds display moles randomly
        this.timer += dt;
        if ((this.timer) >= 500) {

            for (var i = 0; i < 9; i += 3) {
                var hole = (0).random(3) + i ;
                if (!this.moles[hole].isOut && !this.moles[hole].isVisible) {
                    this.moles[hole].display();
                }

            }
            this.timer = 0;
        }
         return false;
    }

});
