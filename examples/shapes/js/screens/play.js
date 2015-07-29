game.PlayScreen = me.ScreenObject.extend({
    /** 
     *  action to perform on state change
     */
    onResetEvent: function() {  
        // clear the background
        me.game.world.addChild(new me.ColorLayer("background", "#5E3F66", 0), 0);
        
        // add a few shapes
        
        // physic-editor
        me.game.world.addChild(new game.Circle(250, 200, {width: 50, height: 50}), 1);
        me.game.world.addChild(new game.Poly(50, 75, {width: 200, height: 200, sprite:"hamburger"}), 1);
        me.game.world.addChild(new game.Poly(50, 200, {width: 200, height: 200, sprite:"hotdog"}), 1);
        me.game.world.addChild(new game.Poly(50, 350, {width: 200, height: 200, sprite:"icecream"}), 1);
        me.game.world.addChild(new game.Poly(450, 100, {width: 200, height: 200, sprite:"icecream2"}), 1);
        me.game.world.addChild(new game.Poly(350, 100, {width: 200, height: 200, sprite:"icecream3"}), 1);
        
        // physic-body-editor
        me.game.world.addChild(new game.Poly2(540, 50, {width: 256, height: 256, sprite:"test03"}), 1);
        me.game.world.addChild(new game.Poly2(200, 275, {width: 300, height: 300, sprite:"test02"}), 1);
        me.game.world.addChild(new game.Poly2(526, 325, {width: 256, height: 256, sprite:"test01"}), 1);
        
        // display the current pointer coordinates on top of the pointer arrow
        me.game.world.addChild(new (me.Renderable.extend({
            init: function() {
                this._super(me.Renderable, 'init', [0, 0, 10, 10]);
                this.font = new me.Font("Arial", 10, "#FFFFFF");
                this.font.textAlign = "center";
                this.fontHeight = this.font.measureText(me.video.renderer, "DUMMY").height;
            },
            draw: function(renderer){
                var x = Math.round(me.input.pointer.pos.x);
                var y = Math.round(me.input.pointer.pos.y);
                this.font.draw (
                    renderer, 
                    "( " + x + "," + y + " )", 
                    x, 
                    y - this.fontHeight);
            }
        })), Infinity);
        
    }
});
