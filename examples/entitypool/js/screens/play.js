(function() {
  var drawn = false;
  var main;
  game.PlayScreen = me.ScreenObject.extend({
    init: function() {
      this.parent(true);
    },

    onResetEvent: function() {
      // tell the entity pool what classes it needs to work with
      me.entityPool.add('main', game.MainEntity, true);
      me.entityPool.add('renderable', game.RenderableEntity, true);

      // create the main
      main = me.entityPool.newInstanceOf('main', 100, 100);
      this.timer = me.timer.getTime();
      me.game.world.addChild(new game.Background());
      me.game.world.addChild(main);
    },

    onDestroyEvent: function() {

    },

    update: function() {
      if(!drawn && me.timer.getTime() - this.timer > 3000) {
        drawn = true;
        // purge the main
        me.game.world.removeChild(main);
        // main will get re-used but initialized elsewhere.
        main = me.entityPool.newInstanceOf('main', 20, 20);
        // create the renderable
        var renderable = me.entityPool.newInstanceOf('renderable', 120, 120);
        me.game.world.addChild(main);
        me.game.world.addChild(renderable);
      }
      return true;
    }
  });
}).call(this);