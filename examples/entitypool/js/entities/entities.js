game.Background = me.Renderable.extend({
  init : function() {
    this._super(me.Renderable, 'init', [new me.Vector2d(0, 0), me.game.viewport.width, me.game.viewport.height]);
    this.z = 1;
  },
  draw : function(ctx) {
    me.video.clearSurface(ctx, '#000');
  }
});

game.MainEntity = me.ObjectEntity.extend({
  init : function(x, y) {
    var settings = {
      image : 'basicImage',
      spritewidth : 32,
      spriteheight : 32,
      width : 32,
      height : 32
    };
    this._super(me.ObjectEntity, 'init', [x, y, settings]);
    this.z = 2;
    this.renderable.addAnimation('idle', [0], 1);
    this.renderable.setCurrentAnimation('idle');
  },

  update: function(delta) {
    this._super(me.ObjectEntity, 'update', [delta]);
  }
});

game.RenderableEntity = me.Renderable.extend({
  init : function(x, y) {
    this._super(me.Renderable, 'init', [new me.Vector2d(x, y), 100, 100]);
    this.z = 2;
  },

  draw : function(context) {
    context.save();
    context.fillStyle = '#fff';
    context.fillRect(this.pos.x, this.pos.y, this.width, this.height);
    context.restore();
  }
});