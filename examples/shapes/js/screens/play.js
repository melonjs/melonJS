game.PlayScreen = me.Stage.extend({
    /**
     *  action to perform on state change
     */
    onResetEvent: function() {

        // clear the background
        me.game.world.addChild(new me.ColorLayer("background", "#5E3F66"), 0);

        // add a few shapes
        me.game.world.addChild(new game.Sprite(100, 100, {sprite: "hamburger"}));
        me.game.world.addChild(new game.Sprite(200, 200, {sprite: "icecream3"}));
        me.game.world.addChild(new game.Sprite(300, 100, {sprite: "icecream2"}));
        me.game.world.addChild(new game.Sprite(400, 200, {sprite: "hotdog"}));
        me.game.world.addChild(new game.Sprite(500, 100, {sprite: "icecream"}));
        me.game.world.addChild(new game.Sprite(600, 200, {sprite: "drink"}));
        // use a regular circle shape for this one
        me.game.world.addChild(new game.Sprite(250, 350,  {
            sprite: "orange",
            // orange sprite is 58x59
            shape : new me.Ellipse(29, 29.5, 58, 59)
        }));


        // display the current pointer coordinates on top of the pointer arrow
        me.game.world.addChild(new (me.Renderable.extend({
            init: function() {
                this._super(me.Renderable, 'init', [0, 0, 10, 10]);
                this.font = new me.Text(0, 0, {font: "Arial", size: 10, fillStyle: "#FFFFFF"});
                this.font.textAlign = "center";
                this.font.textBaseline = "bottom";
            },
            update : function (dt) {
                return true;
            },
            draw: function(renderer) {
                if (typeof me.plugins.debugPanel !== "undefined" && me.plugins.debugPanel.panel.visible === true) {
                    var x = Math.round(me.input.pointer.gameWorldX);
                    var y = Math.round(me.input.pointer.gameWorldY);
                    this.font.draw(renderer, "( " + x + "," + y + " )", x, y );
                }
            }
        })), 10);
    }
});
