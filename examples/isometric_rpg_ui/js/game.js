/**
 * main
 */
var game = {

    /**
     *
     * Initialize the application
     */
    onload: function() {

        // init the video
        if (!me.video.init(800, 600, {wrapper : "screen", scale : "auto"})) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // set all ressources to be loaded
        me.loader.preload(game.resources, this.loaded.bind(this));
    },


    /**
     * callback when everything is loaded
     */
    loaded: function ()    {

      // load the texture atlas file
      // this will be used by object entities later
      game.texture = new me.video.renderer.Texture(
          me.loader.getJSON("UI_Assets"),
          me.loader.getImage("UI_Assets")
      );


        // set the "Play/Ingame" Screen Object
        me.state.set(me.state.PLAY, new game.PlayScreen());

        // set the fade transition effect
        me.state.transition("fade","#FFFFFF", 250);

        // register our objects entity in the object pool
        me.pool.register("mainPlayer", game.PlayerEntity);

        me.pool.register("UIContainer", game.UI.Container);
        me.pool.register("UICheckBox", game.UI.CheckBoxUI);
        me.pool.register("UIButton", game.UI.ButtonUI);

        // switch to PLAY state
        me.state.change(me.state.PLAY);
    }
};
