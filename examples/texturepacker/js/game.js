
/* Game namespace */
var game = {
  // Run on page load.
  onload: function () {
    // init the video
    if (!me.video.init(960, 640, {wrapper : "screen", scale : "auto"})) {
        alert("Your browser does not support HTML5 canvas.");
        return;
    }

    // add "#debug" to the URL to enable the debug Panel
    if (me.game.HASH.debug === true) {
      window.onReady(function () {
      me.plugin.register.defer(this, me.debug.Panel, "debug");
      });
    }

    // Initialize the audio.
    me.audio.init("mp3,ogg");

    // Set a callback to run when loading is complete.
    me.loader.onload = this.loaded.bind(this);

    // Load the resources.
    me.loader.preload(game.resources);

    // Initialize melonJS and display a loading screen.
    me.state.change(me.state.LOADING);
  },



  // Run on game resources loaded.
  loaded : function () {
    this.texture = new me.video.renderer.Texture(
      me.loader.getJSON("texture"),
      me.loader.getImage("texture")
    );
    me.state.set(me.state.PLAY, new game.PlayScreen());

    // Start the game.
    me.state.change(me.state.PLAY);
  }
};
