

var myVector = me.Vector2d.extend( {
    
    a : new me.Vector2d(0.5, 0.5),

});

var myVector2 = myVector.extend( {
    
    a : new me.Vector2d(1.5, 1.5),

});

var main = {
    
    
	/**
	 * Initialize the application
	 */
	 onload: function() {
     
        var orig = new myVector(50, 50);
        var orig2 = new myVector2(50, 50);

        console.log(orig.a); // 0.5, 0.5
        console.log(orig instanceof me.Vector2d); // true
        
        
        console.log(orig2.a); // 1.5, 1.5
        console.log(orig2 instanceof me.Vector2d); // true


	}
	

	
}; // main


//bootstrap :)
window.onReady(function() {
	main.onload();
});
