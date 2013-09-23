game.PlayScreen = me.ScreenObject.extend({
  init: function() {
    this.parent(true, true);
    this.font = new me.Font('arial', '24px', '#fff');
  },
  draw: function(ctx) {
    me.video.clearSurface(ctx, '#000');
    var o = me.device;
    this.font.draw(ctx, "Gamma: " + o.gamma, 10, 0);
    this.font.draw(ctx, "Beta: " + o.beta, 10, 30);
    this.font.draw(ctx, "Alpha: " + o.alpha, 10, 60);
    this.font.draw(ctx, "X: " + o.accelerationX, 10, 90);
    this.font.draw(ctx, "Y: " + o.accelerationY, 10, 120);
    this.font.draw(ctx, "Z: " + o.accelerationZ, 10, 150);
  },
  onResetEvent: function() {  
    me.device.watchDeviceOrientation();
    me.device.watchAccelerometer();
  },
  
  
  /**  
   *  action to perform when leaving this screen (state change)
   */
  onDestroyEvent: function() {
    me.device.unwatchDeviceOrientation();
    me.device.unwatchAccelerometer();
  },

  update: function() {
    return true;
  }
});
