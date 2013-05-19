game.square = me.Renderable.extend({	
	init:function (x, y) {
		// call the constructor
		this.parent(new me.Vector2d(x, y) , 100, 100);
		
		// selected flag
		this.selected = false;
		
		// to memorize where we grab the square
		this.grabOffset = new me.Vector2d(0,0);
		
		// white : unselected
		// red : selected
		this.color = "white";
		
		// store the id of the corresponding 
		// touch event (when selected)
		this.pointerId = null;
		
		// register required events
		me.event.subscribe("mousemove", this.onMoveEvent.bind(this));
		me.input.registerMouseEvent('mousedown', this, this.onStartEvent.bind(this));
		me.input.registerMouseEvent('mouseup', this, this.onEndEvent.bind(this));

	},

	/**
	 * return the corresponding "local" touch position
	 */	
	getTouchPosition : function (pointerId) {
		for(var i=0, l=me.input.changedTouches.length; i<l; i++) {
			if (me.input.changedTouches[i].id === pointerId) {
				return me.input.changedTouches[i];
			}
		}
		return null;
	},
	
	/**
	 * callback for move event
	 */
	onMoveEvent : function(e) {
		if (this.selected === true) {
			if (this.pointerId === e.pointerId) {
				// follow the mouse/finger
				this.pos.setV(this.getTouchPosition(e.pointerId));
				this.pos.sub(this.grabOffset);
				// don't propagate this event furthemore
				return false;
			}
		}
	},
	
	/**
	 * callback for event click
	 */
	onStartEvent : function(e) {
		if (this.selected === false) {
			this.pointerId = e.pointerId;
			this.selected = true;
			this.color = "red";
			this.grabOffset.setV(this.getTouchPosition(e.pointerId));
			this.grabOffset.sub(this.pos);
			// don't propagate this event furthemore
			return false;
		}
	},

	/**
	 * callback for event click
	 */
	onEndEvent : function(e) {
		if (this.selected === true) {
			this.pointerId = undefined;
			this.selected = false;
			this.color = "white";
			// don't propagate this event furthemore
			return false;
		}
	},
	
	/**
	 * update function
	 */
	update : function () {
		return true;
	},
	
	/**
	 * draw the square
	 */
	draw : function (context) {
      context.fillStyle = this.color;
      context.fillRect (this.pos.x,this.pos.y,this.width,this.height);
	},
	
	/**
	 * called when the object is destroyed
	 */
	destroy : function() {
		// unregister events
		me.input.releaseMouseEvent('mousedown', this);
		me.input.releaseMouseEvent('mouseup', this);
	}
});
