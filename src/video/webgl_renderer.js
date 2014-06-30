(function () {

  var WebGLContext = null;
  var context;
  var gl;

  me.webGLRenderer = {
    init : function (width, height, canvas) {
      WebGLContext = require("kami").WebGLContext;
      context = new WebGLContext(width, height, canvas);
      gl = context.gl;
    }
  };

})();