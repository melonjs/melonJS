/*
 * MelonJS Game Engine
 * Copyright (C) 2011, Olivier BIOT
 * http://olivierbiot.wordpress.com/
 *
 *
 */

(function($, undefined)
{	
	
	/*---
	
	 	a collection of utility Function
								---*/
	
	var Utils  = (function()
	{
		// hold public stuff in our singletong
		var api	= {};
		
		/*---------------------------------------------
			
			PRIVATE STUFF
				
			---------------------------------------------*/
		var b64chrs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split("");
		var b64inv  = null;
		
		// some basic init
		function initb64()
		{
			if (b64inv == null) 
			{
				b64inv = {};
				// create the inverse list for decoding
				for (var i = 0; i < b64chrs.length; i++) 
					b64inv[b64chrs[i]] = i; 
			}
		};
		
		
		/*---------------------------------------------
			
			PUBLIC STUFF
				
			---------------------------------------------*/
		
		/*---
	
	 	some Base64 usefull stuff
		taken from :
		http://en.wikibooks.org/wiki/Algorithm_Implementation/Miscellaneous/Base64#Javascript_2
	
								--- */
	
		api.decodeNumBase64 = function (s) 
		{
			 // init some usefull stuff if not yet done
			 initb64();
			 
			 // decode our string
			 s = s.replace(new RegExp('[^'+b64chrs.join("")+'=]', 'g'), "");

			 p = (s.charAt(s.length-1) == '=' ? 
			  	  (s.charAt(s.length-2) == '=' ? 'AA' : 'A') : "");
			 
			 r = []; 
			 
			 s = s.substr(0, s.length - p.length) + p;

			 for (c = 0; c < s.length; c += 4) {
				n = (b64inv[s.charAt(c)] << 18) + (b64inv[s.charAt(c+1)] << 12) +
				    (b64inv[s.charAt(c+2)] << 6) + b64inv[s.charAt(c+3)];

				r.push((n >>> 16) & 255);
				r.push((n >>> 8) & 255);
				r.push(n & 255);
			 }
			 return r;
		};
		
	
	   /* ---
		 
			enable the nocache mechanism
		  
		  ---*/
		api.setNocache = function(enable)
		{
			me.nocache = enable?"?"+parseInt(Math.random()*10000000):'';
			
			//console.log(jTB.nocache);
		};
		
		
		/* ---
		
			return a random between min, max
			---										*/
		api.random = function(min, max)
		{
			return (~~(Math.random()*(max - min + 1)) + min); //floor
		};
		
		/* ---
		
			round "num" with "dec" digit
			---										*/
		
		api.round = function(num, dec) 
		{	
			var powres = Math.pow(10,dec);
			return (Math.round(num*powres)/powres);
		};
	
		// a Hex to RGB color function
		api.HexToRGB = function(h, a)
		{
			// remove the # if present
			h = (h.charAt(0)=="#") ? h.substring(1,7):h;
			rgb  = (a?"rgba(":"rgb(")+ parseInt(h.substring(0,2),16);
			rgb += ","   + parseInt(h.substring(2,4),16);
			rgb += ","   + parseInt(h.substring(4,6),16) + (a?","+a+")":")");
			return rgb;
		};
		
		// return our object
		return api;
	

	})();

	
	/*---------------------------------------------------------*/
	// expose our stuff to the global scope
	/*---------------------------------------------------------*/
	$.me.utils						= Utils;

/*---------------------------------------------------------*/
// END END END
/*---------------------------------------------------------*/
})(window);
