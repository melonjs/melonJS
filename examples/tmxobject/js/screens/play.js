(function() {
  var main;
  game.PlayScreen = me.ScreenObject.extend({
    onResetEvent: function() {
      me.levelDirector.loadLevel("level");

      me.game.world.addChild(new (me.Renderable.extend({
        init: function () {
          var object = me.game.currentLevel.objectGroups[0].objects[0];
          this._super(me.Renderable, "init", [new me.Vector2d(object.x, object.y), object.width, object.height]);
        },
        draw: function (context) {
          var object = me.game.currentLevel.objectGroups[0].objects[0];
          context.beginPath();
          context.fillStyle = '#33aa33';
          context.arc(object.x + object.width / 2, object.y + object.height / 2, object.width / 2, 0, 2 * Math.PI, false);
          context.fill();
        }
      })), 5);
    }
  });
}).call(this);