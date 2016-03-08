/**
 * Whack-A-Mole
 * Freely reused from the Cocos2d Whack-a-mole Tutorial
 * http://maniacdev.com/2011/01/tutorial-cocos2d-example-whack-a-mole-game/
 * Original version by Ray Wenderlich, the creator of the Space Game Starter
 * Kit and co-author of the Learning Cocos2D book, as part of an excellent set
 * of iOS tutorials on how to create a whack-a-mole game using the open source
 * iPhone game engine Cocos2D.
 **/
var game = {

    /**
     * local game data
     */
    data : {
        // score information
        score : 0,
        hiscore : 0,
    },

    /**
     * some Initialization
     */
    onload: function() {

        // we don't need the default 60fps for a whack-a-mole !
        me.sys.fps = 30;

        // Initialize the video.
        if (!me.video.init(1024, 768, {wrapper : "screen", scale : "auto"})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // initialize the "sound engine"
        me.audio.init("mp3,ogg");

        // add a new hiscore key if not yet defined
        me.save.add({hiscore : 0});
        // set the local hiscore value
        game.data.hiscore = me.save.hiscore;

        // set all ressources to be loaded
        me.loader.preload(game.resources, this.loaded.bind(this));
    },


    /**
     * callback when everything is loaded
     */
    loaded: function () {

        // set the "Play/Ingame" Screen Object
        me.state.set(me.state.PLAY, new game.PlayScreen());

        // set a fade transition effect
        me.state.transition("fade","#000000", 250);

        // start the game
        me.state.change(me.state.PLAY);
    }

}; // game
