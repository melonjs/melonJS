(function() {
  var main;
  game.PlayScreen = me.ScreenObject.extend({
    onResetEvent: function() {
      // tell the entity pool what classes it needs to work with
      me.pool.register('main', game.MainEntity, true);
      me.pool.register('renderable', game.RenderableEntity, true);

      // create the main
      main = me.pool.pull('main', 100, 100);
      me.game.world.addChild(new game.Background());
      me.game.world.addChild(main);
      
      me.game.world.addChild(new (me.Renderable.extend({
        init: function() {
            this._super(me.Renderable, 'init', [new me.Vector2d(), 100, 100]);
            this.drawn = false;
            this.elapsed = 0;
        },
        update: function(dt) {
            this.elapsed += dt;
            if(!this.drawn && this.elapsed > 3000) {
                this.drawn = true;
                this.elapsed = 0;
                // purge the main
                me.game.world.removeChild(main);
                // main will get re-used but initialized elsewhere.
                main = me.pool.pull('main', 20, 20);
                // create the renderable
                var renderable = me.pool.pull('renderable', 120, 120);
                me.game.world.addChild(main);
                me.game.world.addChild(renderable);
            }
            return true;
        }
      })));
    }
  });
}).call(this);