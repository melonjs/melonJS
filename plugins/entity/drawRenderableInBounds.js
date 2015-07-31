/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2015, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * This plugin adds the old entity.renderable positioning method as an option.
 * To enable in an entity, set the entity's "drawRenderableInBounds" property to true.
 * 
 * usage : me.plugin.register(me.plugin.entity.drawRenderableInBounds, "entity.drawRenderableInBounds");
 * 
 * Note: Make sure this plugin runs before the debugPanel plugin.
 */

console.log('asdfasfsfs');
(function() {
    
    me.plugin = me.plugin || {};
    me.plugin.entity = me.plugin.entity || {};
    
    /**
     * @class
     * @public
     * @extends me.plugin.Base
     * @memberOf me
     * @constructor
     */
    me.plugin.entity.drawRenderableInBounds = me.plugin.Base.extend(
    /** @scope me.debug.Panel.prototype */
    {

        /** @private */
        init : function () {
            // call the super constructor
            this._super(me.plugin.Base, "init");

            // patch me.game.draw
            me.plugin.patch(me.Entity, "draw", function (renderer) {
                
                if (this.drawRenderableInBounds) {
                    var x = ~~( 0.5 + this.pos.x + this.body.pos.x +
                        (this.anchorPoint.x * (this.body.width - this.renderable.width))) + (this.renderable.anchorPoint.x * this.renderable.width);
                    var y = ~~( 0.5 + this.pos.y + this.body.pos.y +
                        (this.anchorPoint.y * (this.body.height - this.renderable.height))) + (this.renderable.anchorPoint.y * this.renderable.height);
                    renderer.translate(x, y);
                    this.renderable.draw(renderer);
                    renderer.translate(-x, -y);
                } else {
                    this._patched(renderer);
                }

            });
            
        }
    });
    
})();
 
