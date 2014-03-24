game.PlayScreen = me.ScreenObject.extend({
    /** 
     *  action to perform on state change
     */
    onResetEvent: function() {  
    
        me.device.watchDeviceOrientation();
        me.device.watchAccelerometer();
        
        // clear the background
        me.game.world.addChild(new me.ColorLayer("background", "#000000", 0));
        
        // renderable to display device information
        me.game.world.addChild(new (me.Renderable.extend({
            init: function() {
                this._super(me.Renderable, 'init', [new me.Vector2d(), 100, 200]);
                this.font = new me.Font('arial', '24px', '#fff');
            },
            update: function() {
                return true;
            },
            draw: function(context) {
                this.font.draw(context, "Gamma: " + me.device.gamma, 10, 0);
                this.font.draw(context, "Beta: " + me.device.beta, 10, 30);
                this.font.draw(context, "Alpha: " + me.device.alpha, 10, 60);
                this.font.draw(context, "X: " + me.device.accelerationX, 10, 90);
                this.font.draw(context, "Y: " + me.device.accelerationY, 10, 120);
                this.font.draw(context, "Z: " + me.device.accelerationZ, 10, 150);
                this.font.draw(context, "orientation: " + me.device.orientation + " degrees", 10, 180);
            }
        })), 1);
    },
  
    /**  
     *  action to perform when leaving this screen (state change)
     */
    onDestroyEvent: function() {
        me.device.unwatchDeviceOrientation();
        me.device.unwatchAccelerometer();
    }
});
