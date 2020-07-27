
/* Game namespace */
var game = {

    // an object where to store game information
    data : {
        // score
        score : 0
    },


    // Run on page load.
    "onload" : function () {
    // Initialize the video.
    if (!me.video.init(800, 400, {parent : "screen", scale : "auto"})) {
        alert("Your browser does not support HTML5 canvas.");
        return;
    }

    // Initialize the audio.
    me.audio.init("mp3,ogg");

    // set all ressources to be loaded
    me.loader.preload(game.resources, this.loaded.bind(this));
},

    // Run on game resources loaded.
    "loaded" : function () {

        // load the texture atlas file
        game.texture = new me.video.renderer.Texture(
            me.loader.getJSON("cityscene"),
            me.loader.getImage("cityscene")
        );

        me.state.set(me.state.PLAY, new game.PlayScreen());

        // Start the game.
        me.state.change(me.state.PLAY);
    }
};
