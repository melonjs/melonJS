

var myVect1 = me.Vector2d.extend( {
    
    a : new me.Vector2d(0.5, 0.5),
    
    b : [1,2,3]

});

var myVect2 = myVect1.extend( {
    
    a : new me.Vector2d(1.5, 1.5),

});

var main = {
    
    
	/**
	 * Initialize the application
	 */
	 onload: function() {
     
        var vec1 = new myVect1(50, 50);
        var vec2 = new myVect2(50, 50);

        console.log(vec1.a); // Object (x:0.5, y:0.5)
        console.log(vec1 instanceof me.Vector2d); // true
        console.log(!(vec1 instanceof myVect2)); // true
        
        console.log(vec2.a); // Object (x:1.5, y:1.5)
        console.log(vec2 instanceof me.Vector2d); // true
        console.log(vec2 instanceof myVect1); // true (myVect2 inherits from myVect1)
    
        console.log(vec1.a !== vec2.a); // true
        
        // change the value of the first array element in b
        vec2.b[0] = 3;
        
        // compare both arrays
        console.log(vec1.b[0] + " !== " + vec2.b[0]);
        console.log(vec1.b !== vec2.b); // true
        console.log(vec1.b[0] !== vec2.b[0]); // true
	}
	

	
}; // main


//bootstrap :)
window.onReady(function() {
	main.onload();
});
