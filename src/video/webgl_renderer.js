(function () {

  var WebGLContext = null;
  var gl;

  me.webGLRenderer = {
    init : function (width, height, canvas) {
      WebGLContext = require("kami").WebGLContext;
      this.context = new WebGLContext(width, height, canvas);
      gl = this.context.gl;
    }
  };

})();