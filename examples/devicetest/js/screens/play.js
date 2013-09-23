game.PlayScreen = me.ScreenObject.extend({
  init: function() {
    this.parent(true, true);
    this.font = new me.Font('arial', '24px', '#fff');
  },
  draw: function(ctx) {
    me.video.clearSurface(ctx, '#000');
    var o = me.device.orientation;
    this.font.draw(ctx, o.gamma + "," + o.beta + "," + o.alpha, 10, 0);
  },
  onResetEvent: function() {  
    me.device.watchDeviceOrientation();
  },
  
  
  /**  
   *  action to perform when leaving this screen (state change)
   */
  onDestroyEvent: function() {
    me.device.unwatchDeviceOrientation();
  },

  update: function() {
    return true;
  }
});
