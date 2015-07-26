(function() {

game.PlayScreen = me.ScreenObject.extend({
    onResetEvent: function() {
        var main;
        var renderable;

        // tell the entity pool what classes it needs to work with
        me.pool.register("main", game.MainEntity, true);
        me.pool.register("renderable", game.RenderableEntity, true);

        // create the main
        main = me.pool.pull("main", 100, 100);
        renderable = me.pool.pull("renderable", 120, 120);
        me.game.world.addChild(new game.Background());
        me.game.world.addChild(main);
        me.game.world.addChild(renderable);

        var Generator = me.Renderable.extend({
            init: function() {
                this._super(me.Renderable, "init", [0, 0, 100, 100]);
                this.elapsed = 0;
                this.odd = true;
            },
            update: function(dt) {
                this.elapsed += dt;
                if(this.elapsed > 1000) {
                    this.elapsed = 0;
                    this.odd = !this.odd;
                    // purge the main
                    me.game.world.removeChild(main);
                    me.game.world.removeChild(renderable);
                    // main will get re-used but initialized elsewhere
                    main = me.pool.pull("main", this.odd ? 100 : 200, this.odd ? 100 : 200);
                    // create the renderable
                    renderable = me.pool.pull("renderable", this.odd ? 120 : 220, this.odd ? 120 : 220);
                    me.game.world.addChild(main);
                    me.game.world.addChild(renderable);
                }
                return true;
            }
        });

        me.game.world.addChild(new Generator());
    }
});

})();
