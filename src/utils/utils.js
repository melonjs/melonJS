/*
 * MelonJS Game Engine
 * Copyright (C) 2011, Olivier BIOT
 * http://olivierbiot.wordpress.com/
 *
 *
 */

(function($, undefined)
{	
	
   /**
    *  Base64 decoding
    *  @see <a href="http://www.webtoolkit.info/">http://www.webtoolkit.info/</A>
    */
   var Base64  = (function()
   {
      
      // hold public stuff in our singletong
		var singleton	= {};
      
      // private property
      var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

   
      // public method for decoding
      singleton.decode = function (input) 
      {
         var output = [],
            chr1, chr2, chr3,
            enc1, enc2, enc3, enc4,
            i = 0;

         input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

         while (i < input.length) 
         {
            enc1 = _keyStr.indexOf(input.charAt(i++));
            enc2 = _keyStr.indexOf(input.charAt(i++));
            enc3 = _keyStr.indexOf(input.charAt(i++));
            enc4 = _keyStr.indexOf(input.charAt(i++));

            chr1 = (enc1 << 2)   | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            output.push(String.fromCharCode(chr1));

            if (enc3 != 64) {
                output.push(String.fromCharCode(chr2));
            }
            if (enc4 != 64) {
                output.push(String.fromCharCode(chr3));
            }
         }
        
         output = output.join('');
         return output;
    };
   
    return singleton;

   })();

   
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
      
      // cache rgb converted value
      var rgbCache = {};
      
		/*---------------------------------------------
			
			PUBLIC STUFF
				
			---------------------------------------------*/
		
      /**
       * Decode a base64 encoded string into a binary string
       *
       * @param {String} input Base64 encoded data
       * @return {String} Binary string
       */
      api.decodeBase64 =  function(input) 
      {
        return Base64.decode(input);
      };
		
       /**
        * Decode a base64 encoded string into a byte array
        *
        * @param {String} input Base64 encoded data
        * @param {Int} [bytes] number of bytes per array entry
        * @return {Int[]} Array of bytes
        */
       api.decodeBase64AsArray = function(input, bytes) 
       {
           bytes = bytes || 1;

           var dec = Base64.decode(input),
               ar = [], i, j, len;

           for (i = 0, len = dec.length/bytes; i < len; i++)
           {
               ar[i] = 0;
               for (j = bytes-1; j >= 0; --j)
               {
                   ar[i] += dec.charCodeAt((i * bytes) +j) << (j << 3);
               }
           }
           return ar;
       };

      /**
       * Decode a CSV encoded array into a binary array
       *
       * @param  {String} input CSV formatted data
       * @param  {Int} limit row split limit
       * @return {Int[]} Int Array
       */
      api.decodeCSV =  function(input, limit) 
      {
         input = input.trim().split("\n");
         
         var result = [];
         for(var i=0; i < input.length; i++)
         {
				entries = input[i].split(",", limit);
            for(var e=0; e < entries.length; e++)
            {
					result.push(+entries[e]);
				}
			}
			return result;
      };
    
	   /* ---
		 
			enable the nocache mechanism
		  
		  ---*/
		api.setNocache = function(enable)
		{
			me.nocache = enable?"?"+parseInt(Math.random()*10000000):'';
		};
			
		
		// a Hex to RGB color function
		api.HexToRGB = function(h, a)
		{
         // remove the # if present
         h = (h.charAt(0)=="#") ? h.substring(1,7):h;
			// check if we already have the converted value cached
         if (rgbCache[h]==null)
         {
            // else add it (format : "r,g,b")
            rgbCache[h] = parseInt(h.substring(0,2),16) + "," + parseInt(h.substring(2,4),16) + "," + parseInt(h.substring(4,6),16);
         }
			return (a?"rgba(":"rgb(")+ rgbCache[h] + (a?","+a+")":")");
		};

      // a Hex to RGB color function
		api.RGBToHex = function(r, g, b)
		{
			 return r.toHex() + g.toHex() + b.toHex();
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
