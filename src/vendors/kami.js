!function(e){"object"==typeof exports?module.exports=e():"function"==typeof define&&define.amd?define(e):"undefined"!=typeof window?window.kami=e():"undefined"!=typeof global?global.kami=e():"undefined"!=typeof self&&(self.kami=e())}(function(){var define,module,exports;
return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * The core kami module provides basic 2D sprite batching and 
 * asset management.
 * 
 * @module kami
 */

var Class = require('klasse');
var Mesh = require('./glutils/Mesh');

var colorToFloat = require('number-util').colorToFloat;

/** 
 * A batcher mixin composed of quads (two tris, indexed). 
 *
 * This is used internally; users should look at 
 * {{#crossLink "SpriteBatch"}}{{/crossLink}} instead, which inherits from this
 * class.
 * 
 * The batcher itself is not managed by WebGLContext; however, it makes
 * use of Mesh and Texture which will be managed. For this reason, the batcher
 * does not hold a direct reference to the GL state.
 *
 * Subclasses must implement the following:  
 * {{#crossLink "BaseBatch/_createShader:method"}}{{/crossLink}}  
 * {{#crossLink "BaseBatch/_createVertexAttributes:method"}}{{/crossLink}}  
 * {{#crossLink "BaseBatch/getVertexSize:method"}}{{/crossLink}}  
 * 
 * @class  BaseBatch
 * @constructor
 * @param {WebGLContext} context the context this batcher belongs to
 * @param {Number} size the optional size of this batch, i.e. max number of quads
 * @default  500
 */
var BaseBatch = new Class({

  //Constructor
  initialize: function BaseBatch(context, size) {
    if (typeof context !== "object")
      throw "GL context not specified to SpriteBatch";
    this.context = context;

    this.size = size || 500;
    
    // 65535 is max index, so 65535 / 6 = 10922.
    if (this.size > 10922)  //(you'd have to be insane to try and batch this much with WebGL)
      throw "Can't have more than 10922 sprites per batch: " + this.size;
        
    
    
    this._blendSrc = this.context.gl.ONE;
    this._blendDst = this.context.gl.ONE_MINUS_SRC_ALPHA
    this._blendingEnabled = true;
    this._shader = this._createShader();

    /**
     * This shader will be used whenever "null" is passed
     * as the batch's shader. 
     *
     * @property {ShaderProgram} shader
     */
    this.defaultShader = this._shader;

    /**
     * By default, a SpriteBatch is created with its own ShaderProgram,
     * stored in `defaultShader`. If this flag is true, on deleting the SpriteBatch, its
     * `defaultShader` will also be deleted. If this flag is false, no shaders
     * will be deleted on destroy.
     *
     * Note that if you re-assign `defaultShader`, you will need to dispose the previous
     * default shader yoursel. 
     *
     * @property ownsShader
     * @type {Boolean}
     */
    this.ownsShader = true;

    this.idx = 0;

    /**
     * Whether we are currently drawing to the batch. Do not modify.
     * 
     * @property {Boolean} drawing
     */
    this.drawing = false;

    this.mesh = this._createMesh(this.size);


    /**
     * The ABGR packed color, as a single float. The default
     * value is the color white (255, 255, 255, 255).
     *
     * @property {Number} color
     * @readOnly 
     */
    this.color = colorToFloat(255, 255, 255, 255);
    
    /**
     * Whether to premultiply alpha on calls to setColor. 
     * This is true by default, so that we can conveniently write:
     *
     *     batch.setColor(1, 0, 0, 0.25); //tints red with 25% opacity
     *
     * If false, you must premultiply the colors yourself to achieve
     * the same tint, like so:
     *
     *     batch.setColor(0.25, 0, 0, 0.25);
     * 
     * @property premultiplied
     * @type {Boolean}
     * @default  true
     */
    this.premultiplied = true;
  },

  /**
   * A property to enable or disable blending for this sprite batch. If
   * we are currently drawing, this will first flush the batch, and then
   * update GL_BLEND state (enabled or disabled) with our new value.
   * 
   * @property {Boolean} blendingEnabled
   */
  blendingEnabled: {
    set: function(val) {
      var old = this._blendingEnabled;
      if (this.drawing)
        this.flush();

      this._blendingEnabled = val;

      //if we have a new value, update it.
      //this is because blend is done in begin() / end() 
      if (this.drawing && old != val) {
        var gl = this.context.gl;
        if (val)
          gl.enable(gl.BLEND);
        else
          gl.disable(gl.BLEND);
      }

    },

    get: function() {
      return this._blendingEnabled;
    }
  },

  /**
   * Sets the blend source parameters. 
   * If we are currently drawing, this will flush the batch.
   *
   * Setting either src or dst to `null` or a falsy value tells the SpriteBatch
   * to ignore gl.blendFunc. This is useful if you wish to use your
   * own blendFunc or blendFuncSeparate. 
   * 
   * @property {GLenum} blendDst 
   */
  blendSrc: {
    set: function(val) {
      if (this.drawing)
        this.flush();
      this._blendSrc = val;
    },

    get: function() {
      return this._blendSrc;
    }
  },

  /**
   * Sets the blend destination parameters. 
   * If we are currently drawing, this will flush the batch.
   *
   * Setting either src or dst to `null` or a falsy value tells the SpriteBatch
   * to ignore gl.blendFunc. This is useful if you wish to use your
   * own blendFunc or blendFuncSeparate. 
   *
   * @property {GLenum} blendSrc 
   */
  blendDst: {
    set: function(val) {
      if (this.drawing)
        this.flush();
      this._blendDst = val;
    },

    get: function() {
      return this._blendDst;
    }
  },

  /**
   * Sets the blend source and destination parameters. This is 
   * a convenience function for the blendSrc and blendDst setters.
   * If we are currently drawing, this will flush the batch.
   *
   * Setting either to `null` or a falsy value tells the SpriteBatch
   * to ignore gl.blendFunc. This is useful if you wish to use your
   * own blendFunc or blendFuncSeparate. 
   *
   * @method  setBlendFunction
   * @param {GLenum} blendSrc the source blend parameter
   * @param {GLenum} blendDst the destination blend parameter
   */
  setBlendFunction: function(blendSrc, blendDst) {
    this.blendSrc = blendSrc;
    this.blendDst = blendDst;
  },

  /**
   * This is a setter/getter for this batch's current ShaderProgram.
   * If this is set when the batch is drawing, the state will be flushed
   * to the GPU and the new shader will then be bound.
   *
   * If `null` or a falsy value is specified, the batch's `defaultShader` will be used. 
   *
   * Note that shaders are bound on batch.begin().
   *
   * @property shader
   * @type {ShaderProgram}
   */
  shader: {
    set: function(val) {
      var wasDrawing = this.drawing;

      if (wasDrawing) {
        this.end(); //unbinds the shader from the mesh
      }

      this._shader = val ? val : this.defaultShader;

      if (wasDrawing) {
        this.begin();
      }
    },

    get: function() {
      return this._shader;
    }
  },

  /**
   * Sets the color of this sprite batcher, which is used in subsequent draw
   * calls. This does not flush the batch.
   *
   * If r, g, b, are all numbers, this method assumes that RGB 
   * or RGBA float values (0.0 to 1.0) are being passed. Alpha defaults to one
   * if undefined.
   * 
   * If the first three arguments are not numbers, we only consider the first argument
   * and assign it to all four components -- this is useful for setting transparency 
   * in a premultiplied alpha stage. 
   * 
   * If the first argument is invalid or not a number,
   * the color defaults to (1, 1, 1, 1).
   *
   * @method  setColor
   * @param {Number} r the red component, normalized
   * @param {Number} g the green component, normalized
   * @param {Number} b the blue component, normalized
   * @param {Number} a the alpha component, normalized
   */
  setColor: function(r, g, b, a) {
    var rnum = typeof r === "number";
    if (rnum
        && typeof g === "number"
        && typeof b === "number") {
      //default alpha to one 
      a = (a || a === 0) ? a : 1.0;
    } else {
      r = g = b = a = rnum ? r : 1.0;
    }
    
    if (this.premultiplied) {
      r *= a;
      g *= a;
      b *= a;
    }
    
    this.color = colorToFloat(
      ~~(r * 255),
      ~~(g * 255),
      ~~(b * 255),
      ~~(a * 255)
    );
  },

  /**
   * Called from the constructor to create a new Mesh 
   * based on the expected batch size. Should set up
   * verts & indices properly.
   *
   * Users should not call this directly; instead, it
   * should only be implemented by subclasses.
   * 
   * @method _createMesh
   * @param {Number} size the size passed through the constructor
   */
  _createMesh: function(size) {
    //the total number of floats in our batch
    var numVerts = size * 4 * this.getVertexSize();
    //the total number of indices in our batch
    var numIndices = size * 6;
    var gl = this.context.gl;

    //vertex data
    this.vertices = new Float32Array(numVerts);
    //index data
    this.indices = new Uint16Array(numIndices); 
    
    for (var i=0, j=0; i < numIndices; i += 6, j += 4) 
    {
      this.indices[i + 0] = j + 0; 
      this.indices[i + 1] = j + 1;
      this.indices[i + 2] = j + 2;
      this.indices[i + 3] = j + 0;
      this.indices[i + 4] = j + 2;
      this.indices[i + 5] = j + 3;
    }

    var mesh = new Mesh(this.context, false, 
            numVerts, numIndices, this._createVertexAttributes());
    mesh.vertices = this.vertices;
    mesh.indices = this.indices;
    mesh.vertexUsage = gl.DYNAMIC_DRAW;
    mesh.indexUsage = gl.STATIC_DRAW;
    mesh.dirty = true;
    return mesh;
  },

  /**
   * Returns a shader for this batch. If you plan to support
   * multiple instances of your batch, it may or may not be wise
   * to use a shared shader to save resources.
   * 
   * This method initially throws an error; so it must be overridden by
   * subclasses of BaseBatch.
   *
   * @method  _createShader
   * @return {Number} the size of a vertex, in # of floats
   */
  _createShader: function() {
    throw "_createShader not implemented"
  },  

  /**
   * Returns an array of vertex attributes for this mesh; 
   * subclasses should implement this with the attributes 
   * expected for their batch.
   *
   * This method initially throws an error; so it must be overridden by
   * subclasses of BaseBatch.
   *
   * @method _createVertexAttributes
   * @return {Array} an array of Mesh.VertexAttrib objects
   */
  _createVertexAttributes: function() {
    throw "_createVertexAttributes not implemented";
  },


  /**
   * Returns the number of floats per vertex for this batcher.
   * 
   * This method initially throws an error; so it must be overridden by
   * subclasses of BaseBatch.
   *
   * @method  getVertexSize
   * @return {Number} the size of a vertex, in # of floats
   */
  getVertexSize: function() {
    throw "getVertexSize not implemented";
  },

  
  /** 
   * Begins the sprite batch. This will bind the shader
   * and mesh. Subclasses may want to disable depth or 
   * set up blending.
   *
   * @method  begin
   */
  begin: function()  {
    if (this.drawing) 
      throw "batch.end() must be called before begin";
    this.drawing = true;

    this.shader.bind();

    //bind the attributes now to avoid redundant calls
    this.mesh.bind(this.shader);

    if (this._blendingEnabled) {
      var gl = this.context.gl;
      gl.enable(gl.BLEND);
    }
  },

  /** 
   * Ends the sprite batch. This will flush any remaining 
   * data and set GL state back to normal.
   * 
   * @method  end
   */
  end: function()  {
    if (!this.drawing)
      throw "batch.begin() must be called before end";
    if (this.idx > 0)
      this.flush();
    this.drawing = false;

    this.mesh.unbind(this.shader);

    if (this._blendingEnabled) {
      var gl = this.context.gl;
      gl.disable(gl.BLEND);
    }
  },

  /** 
   * Called before rendering to bind new textures.
   * This method does nothing by default.
   *
   * @method  _preRender
   */
  _preRender: function()  {
  },

  /**
   * Flushes the batch by pushing the current data
   * to GL.
   * 
   * @method flush
   */
  flush: function()  {
    if (this.idx===0)
      return;

    var gl = this.context.gl;

    //premultiplied alpha
    if (this._blendingEnabled) {
      //set either to null if you want to call your own 
      //blendFunc or blendFuncSeparate
      if (this._blendSrc && this._blendDst)
        gl.blendFunc(this._blendSrc, this._blendDst); 
    }

    this._preRender();

    //number of sprites in batch
    var numComponents = this.getVertexSize();
    var spriteCount = (this.idx / (numComponents * 4));
    
    //draw the sprites
    this.mesh.verticesDirty = true;
    this.mesh.draw(gl.TRIANGLES, spriteCount * 6, 0, this.idx);

    this.idx = 0;
  },

  /**
   * Adds a sprite to this batch.
   * The specifics depend on the sprite batch implementation.
   *
   * @method draw
   * @param  {Texture} texture the texture for this sprite
   * @param  {Number} x       the x position, defaults to zero
   * @param  {Number} y       the y position, defaults to zero
   * @param  {Number} width   the width, defaults to the texture width
   * @param  {Number} height  the height, defaults to the texture height
   * @param  {Number} u1      the first U coordinate, default zero
   * @param  {Number} v1      the first V coordinate, default zero
   * @param  {Number} u2      the second U coordinate, default one
   * @param  {Number} v2      the second V coordinate, default one
   */
  draw: function(texture, x, y, width, height, u1, v1, u2, v2) {
  },

  /**
   * Adds a single quad mesh to this sprite batch from the given
   * array of vertices.
   * The specifics depend on the sprite batch implementation.
   *
   * @method  drawVertices
   * @param {Texture} texture the texture we are drawing for this sprite
   * @param {Float32Array} verts an array of vertices
   * @param {Number} off the offset into the vertices array to read from
   */
  drawVertices: function(texture, verts, off)  {
  },

  drawRegion: function(region, x, y, width, height) {
    this.draw(region.texture, x, y, width, height, region.u, region.v, region.u2, region.v2);
  },

  /**
   * Destroys the batch, deleting its buffers and removing it from the
   * WebGLContext management. Trying to use this
   * batch after destroying it can lead to unpredictable behaviour.
   *
   * If `ownsShader` is true, this will also delete the `defaultShader` object.
   * 
   * @method destroy
   */
  destroy: function() {
    this.vertices = null;
    this.indices = null;
    this.size = this.maxVertices = 0;

    if (this.ownsShader && this.defaultShader)
      this.defaultShader.destroy();
    this.defaultShader = null;
    this._shader = null; // remove reference to whatever shader is currently being used

    if (this.mesh) 
      this.mesh.destroy();
    this.mesh = null;
  }
});

module.exports = BaseBatch;

},{"./glutils/Mesh":7,"klasse":10,"number-util":11}],2:[function(require,module,exports){
/**
 * @module kami
 */

// Requires....
var Class         = require('klasse');

var BaseBatch = require('./BaseBatch');

var Mesh          = require('./glutils/Mesh');
var ShaderProgram = require('./glutils/ShaderProgram');

/**
 * A basic implementation of a batcher which draws 2D sprites.
 * This uses two triangles (quads) with indexed and interleaved
 * vertex data. Each vertex holds 5 floats (Position.xy, Color, TexCoord0.xy).
 *
 * The color is packed into a single float to reduce vertex bandwidth, and
 * the data is interleaved for best performance. We use a static index buffer,
 * and a dynamic vertex buffer that is updated with bufferSubData. 
 * 
 * @example
 *      var SpriteBatch = require('kami').SpriteBatch;  
 *      
 *      //create a new batcher
 *      var batch = new SpriteBatch(context);
 *
 *      function render() {
 *          batch.begin();
 *          
 *          //draw some sprites in between begin and end...
 *          batch.draw( texture, 0, 0, 25, 32 );
 *          batch.draw( texture1, 0, 25, 42, 23 );
 * 
 *          batch.end();
 *      }
 * 
 * @class  SpriteBatch
 * @uses BaseBatch
 * @constructor
 * @param {WebGLContext} context the context for this batch
 * @param {Number} size the max number of sprites to fit in a single batch
 */
var SpriteBatch = new Class({

  //inherit some stuff onto this prototype
  Mixins: BaseBatch,

  //Constructor
  initialize: function SpriteBatch(context, size) {
    BaseBatch.call(this, context, size);

    /**
     * The projection Float32Array vec2 which is
     * used to avoid some matrix calculations.
     *
     * @property projection
     * @type {Float32Array}
     */
    this.projection = new Float32Array(2);

    //Sets up a default projection vector so that the batch works without setProjection
    this.projection[0] = this.context.width/2;
    this.projection[1] = this.context.height/2;

    /**
     * The currently bound texture. Do not modify.
     * 
     * @property {Texture} texture
     * @readOnly
     */
    this.texture = null;
  },

  /**
   * This is a convenience function to set the batch's projection
   * matrix to an orthographic 2D projection, based on the given screen
   * size. This allows users to render in 2D without any need for a camera.
   * 
   * @param  {[type]} width  [description]
   * @param  {[type]} height [description]
   * @return {[type]}        [description]
   */
  resize: function(width, height) {
    this.setProjection(width/2, height/2);
  },

  /**
   * The number of floats per vertex for this batcher 
   * (Position.xy + Color + TexCoord0.xy).
   *
   * @method  getVertexSize
   * @return {Number} the number of floats per vertex
   */
  getVertexSize: function() {
    return SpriteBatch.VERTEX_SIZE;
  },

  /**
   * Used internally to return the Position, Color, and TexCoord0 attributes.
   *
   * @method  _createVertexAttribuets
   * @protected
   * @return {[type]} [description]
   */
  _createVertexAttributes: function() {
    var gl = this.context.gl;

    return [ 
      new Mesh.Attrib(ShaderProgram.POSITION_ATTRIBUTE, 2),
       //pack the color using some crazy wizardry 
      new Mesh.Attrib(ShaderProgram.COLOR_ATTRIBUTE, 4, null, gl.UNSIGNED_BYTE, true, 1),
      new Mesh.Attrib(ShaderProgram.TEXCOORD_ATTRIBUTE+"0", 2)
    ];
  },


  /**
   * Sets the projection vector, an x and y
   * defining the middle points of your stage.
   *
   * @method setProjection
   * @param {Number} x the x projection value
   * @param {Number} y the y projection value
   */
  setProjection: function(x, y) {
    var oldX = this.projection[0];
    var oldY = this.projection[1];
    this.projection[0] = x;
    this.projection[1] = y;

    //we need to flush the batch..
    if (this.drawing && (x != oldX || y != oldY)) {
      this.flush();
      this._updateMatrices();
    }
  },

  /**
   * Creates a default shader for this batch.
   *
   * @method  _createShader
   * @protected
   * @return {ShaderProgram} a new instance of ShaderProgram
   */
  _createShader: function() {
    var shader = new ShaderProgram(this.context,
        SpriteBatch.DEFAULT_VERT_SHADER, 
        SpriteBatch.DEFAULT_FRAG_SHADER);
    if (shader.log)
      console.warn("Shader Log:\n" + shader.log);
    return shader;
  },

  /**
   * This is called during rendering to update projection/transform
   * matrices and upload the new values to the shader. For example,
   * if the user calls setProjection mid-draw, the batch will flush
   * and this will be called before continuing to add items to the batch.
   *
   * You generally should not need to call this directly.
   * 
   * @method  updateMatrices
   * @protected
   */
  updateMatrices: function() {
    this.shader.setUniformfv("u_projection", this.projection);
  },

  /**
   * Called before rendering, and binds the current texture.
   * 
   * @method _preRender
   * @protected
   */
  _preRender: function() {
    if (this.texture)
      this.texture.bind();
  },

  /**
   * Binds the shader, disables depth writing, 
   * enables blending, activates texture unit 0, and sends
   * default matrices and sampler2D uniforms to the shader.
   *
   * @method  begin
   */
  begin: function() {
    //sprite batch doesn't hold a reference to GL since it is volatile
    var gl = this.context.gl;
    
    //This binds the shader and mesh!
    BaseBatch.prototype.begin.call(this);

    this.updateMatrices(); //send projection/transform to shader

    //upload the sampler uniform. not necessary every flush so we just
    //do it here.
    this.shader.setUniformi("u_texture0", 0);

    //disable depth mask
    gl.depthMask(false);
  },

  /**
   * Ends the sprite batcher and flushes any remaining data to the GPU.
   * 
   * @method end
   */
  end: function() {
    //sprite batch doesn't hold a reference to GL since it is volatile
    var gl = this.context.gl;
    
    //just do direct parent call for speed here
    //This binds the shader and mesh!
    BaseBatch.prototype.end.call(this);

    gl.depthMask(true);
  },

  /**
   * Flushes the batch to the GPU. This should be called when
   * state changes, such as blend functions, depth or stencil states,
   * shaders, and so forth.
   * 
   * @method flush
   */
  flush: function() {
    //ignore flush if texture is null or our batch is empty
    if (!this.texture)
      return;
    if (this.idx === 0)
      return;
    BaseBatch.prototype.flush.call(this);
    SpriteBatch.totalRenderCalls++;
  },

  /**
   * Adds a sprite to this batch. The sprite is drawn in 
   * screen-space with the origin at the upper-left corner (y-down).
   * 
   * @method draw
   * @param  {Texture} texture the Texture
   * @param  {Number} x       the x position in pixels, defaults to zero
   * @param  {Number} y       the y position in pixels, defaults to zero
   * @param  {Number} width   the width in pixels, defaults to the texture width
   * @param  {Number} height  the height in pixels, defaults to the texture height
   * @param  {Number} u1      the first U coordinate, default zero
   * @param  {Number} v1      the first V coordinate, default zero
   * @param  {Number} u2      the second U coordinate, default one
   * @param  {Number} v2      the second V coordinate, default one
   */
  draw: function(texture, x, y, width, height, u1, v1, u2, v2) {
    if (!this.drawing)
      throw "Illegal State: trying to draw a batch before begin()";

    //don't draw anything if GL tex doesn't exist..
    if (!texture)
      return;

    if (this.texture === null || this.texture.id !== texture.id) {
      //new texture.. flush previous data
      this.flush();
      this.texture = texture;
    } else if (this.idx == this.vertices.length) {
      this.flush(); //we've reached our max, flush before pushing more data
    }

    width = (width===0) ? width : (width || texture.width);
    height = (height===0) ? height : (height || texture.height);
    x = x || 0;
    y = y || 0;

    var x1 = x;
    var x2 = x + width;
    var y1 = y;
    var y2 = y + height;

    u1 = u1 || 0;
    u2 = (u2===0) ? u2 : (u2 || 1);
    v1 = v1 || 0;
    v2 = (v2===0) ? v2 : (v2 || 1);

    var c = this.color;

    //xy
    this.vertices[this.idx++] = x1;
    this.vertices[this.idx++] = y1;
    //color
    this.vertices[this.idx++] = c;
    //uv
    this.vertices[this.idx++] = u1;
    this.vertices[this.idx++] = v1;
    
    //xy
    this.vertices[this.idx++] = x2;
    this.vertices[this.idx++] = y1;
    //color
    this.vertices[this.idx++] = c;
    //uv
    this.vertices[this.idx++] = u2;
    this.vertices[this.idx++] = v1;

    //xy
    this.vertices[this.idx++] = x2;
    this.vertices[this.idx++] = y2;
    //color
    this.vertices[this.idx++] = c;
    //uv
    this.vertices[this.idx++] = u2;
    this.vertices[this.idx++] = v2;

    //xy
    this.vertices[this.idx++] = x1;
    this.vertices[this.idx++] = y2;
    //color
    this.vertices[this.idx++] = c;
    //uv
    this.vertices[this.idx++] = u1;
    this.vertices[this.idx++] = v2;
  },

  /**
   * Adds a single quad mesh to this sprite batch from the given
   * array of vertices. The sprite is drawn in 
   * screen-space with the origin at the upper-left corner (y-down).
   *
   * This reads 20 interleaved floats from the given offset index, in the format
   *
   *  { x, y, color, u, v,
   *      ...  }
   *
   * @method  drawVertices
   * @param {Texture} texture the Texture object
   * @param {Float32Array} verts an array of vertices
   * @param {Number} off the offset into the vertices array to read from
   */
  drawVertices: function(texture, verts, off) {
    if (!this.drawing)
      throw "Illegal State: trying to draw a batch before begin()";
    
    //don't draw anything if GL tex doesn't exist..
    if (!texture)
      return;


    if (this.texture != texture) {
      //new texture.. flush previous data
      this.flush();
      this.texture = texture;
    } else if (this.idx == this.vertices.length) {
      this.flush(); //we've reached our max, flush before pushing more data
    }

    off = off || 0;
    //TODO: use a loop here?
    //xy
    this.vertices[this.idx++] = verts[off++];
    this.vertices[this.idx++] = verts[off++];
    //color
    this.vertices[this.idx++] = verts[off++];
    //uv
    this.vertices[this.idx++] = verts[off++];
    this.vertices[this.idx++] = verts[off++];
    
    //xy
    this.vertices[this.idx++] = verts[off++];
    this.vertices[this.idx++] = verts[off++];
    //color
    this.vertices[this.idx++] = verts[off++];
    //uv
    this.vertices[this.idx++] = verts[off++];
    this.vertices[this.idx++] = verts[off++];

    //xy
    this.vertices[this.idx++] = verts[off++];
    this.vertices[this.idx++] = verts[off++];
    //color
    this.vertices[this.idx++] = verts[off++];
    //uv
    this.vertices[this.idx++] = verts[off++];
    this.vertices[this.idx++] = verts[off++];

    //xy
    this.vertices[this.idx++] = verts[off++];
    this.vertices[this.idx++] = verts[off++];
    //color
    this.vertices[this.idx++] = verts[off++];
    //uv
    this.vertices[this.idx++] = verts[off++];
    this.vertices[this.idx++] = verts[off++];
  }
});

/**
 * The default vertex size, i.e. number of floats per vertex.
 * @attribute  VERTEX_SIZE
 * @static
 * @final
 * @type {Number}
 * @default  5
 */
SpriteBatch.VERTEX_SIZE = 5;

/**
 * Incremented after each draw call, can be used for debugging.
 *
 *     SpriteBatch.totalRenderCalls = 0;
 *
 *     ... draw your scene ...
 *
 *     console.log("Draw calls per frame:", SpriteBatch.totalRenderCalls);
 *
 * 
 * @attribute  totalRenderCalls
 * @static
 * @type {Number}
 * @default  0
 */
SpriteBatch.totalRenderCalls = 0;

SpriteBatch.DEFAULT_FRAG_SHADER = [
  "precision mediump float;",
  "varying vec2 vTexCoord0;",
  "varying vec4 vColor;",
  "uniform sampler2D u_texture0;",

  "void main(void) {",
  "   gl_FragColor = texture2D(u_texture0, vTexCoord0) * vColor;",
  "}"
].join('\n');

SpriteBatch.DEFAULT_VERT_SHADER = [
  "attribute vec2 "+ShaderProgram.POSITION_ATTRIBUTE+";",
  "attribute vec4 "+ShaderProgram.COLOR_ATTRIBUTE+";",
  "attribute vec2 "+ShaderProgram.TEXCOORD_ATTRIBUTE+"0;",

  "uniform vec2 u_projection;",
  "varying vec2 vTexCoord0;",
  "varying vec4 vColor;",

  "void main(void) {", ///TODO: use a projection and transform matrix
  "   gl_Position = vec4( "
    +ShaderProgram.POSITION_ATTRIBUTE
    +".x / u_projection.x - 1.0, "
    +ShaderProgram.POSITION_ATTRIBUTE
    +".y / -u_projection.y + 1.0 , 0.0, 1.0);",
  "   vTexCoord0 = "+ShaderProgram.TEXCOORD_ATTRIBUTE+"0;",
  "   vColor = "+ShaderProgram.COLOR_ATTRIBUTE+";",
  "}"
].join('\n');

module.exports = SpriteBatch;

},{"./BaseBatch":1,"./glutils/Mesh":7,"./glutils/ShaderProgram":8,"klasse":10}],3:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');
var Signal = require('signals');
var nextPowerOfTwo = require('number-util').nextPowerOfTwo;
var isPowerOfTwo = require('number-util').isPowerOfTwo;

var Texture = new Class({


  /**
   * Creates a new texture with the optional width, height, and data.
   *
   * If the constructor is passed no parameters other than WebGLContext, then
   * it will not be initialized and will be non-renderable. You will need to manually
   * uploadData or uploadImage yourself.
   *
   * If you pass a width and height after context, the texture will be initialized with that size
   * and null data (e.g. transparent black). If you also pass the format and data, 
   * it will be uploaded to the texture. 
   *
   * If you pass a String or Data URI as the second parameter,
   * this Texture will load an Image object asynchronously. The optional third
   * and fourth parameters are callback functions for success and failure, respectively. 
   * The optional fifrth parameter for this version of the constructor is genMipmaps, which defaults to false. 
   * 
   * The arguments are kept in memory for future context restoration events. If
   * this is undesirable (e.g. huge buffers which need to be GC'd), you should not
   * pass the data in the constructor, but instead upload it after creating an uninitialized 
   * texture. You will need to manage it yourself, either by extending the create() method, 
   * or listening to restored events in WebGLContext.
   *
   * Most users will want to use the AssetManager to create and manage their textures
   * with asynchronous loading and context loss. 
   *
   * @example
   *    new Texture(context, 256, 256); //empty 256x256 texture
   *    new Texture(context, 1, 1, Texture.Format.RGBA, Texture.DataType.UNSIGNED_BYTE, 
   *          new Uint8Array([255,0,0,255])); //1x1 red texture
   *    new Texture(context, "test.png"); //loads image asynchronously
   *    new Texture(context, "test.png", successFunc, failFunc, useMipmaps); //extra params for image laoder 
   *
   * @class  Texture
   * @constructor
   * @param  {WebGLContext} context the WebGL context
   * @param  {Number} width the width of this texture
   * @param  {Number} height the height of this texture
   * @param  {GLenum} format e.g. Texture.Format.RGBA
   * @param  {GLenum} dataType e.g. Texture.DataType.UNSIGNED_BYTE (Uint8Array)
   * @param  {GLenum} data the array buffer, e.g. a Uint8Array view
   * @param  {Boolean} genMipmaps whether to generate mipmaps after uploading the data
   */
  initialize: function Texture(context, width, height, format, dataType, data, genMipmaps) {
    if (typeof context !== "object")
      throw "GL context not specified to Texture";
    this.context = context;

    /**
     * The WebGLTexture which backs this Texture object. This
     * can be used for low-level GL calls.
     * 
     * @type {WebGLTexture}
     */
    this.id = null; //initialized in create()

    /**
     * The target for this texture unit, i.e. TEXTURE_2D. Subclasses
     * should override the create() method to change this, for correct
     * usage with context restore.
     * 
     * @property target
     * @type {GLenum}
     * @default  gl.TEXTURE_2D
     */
    this.target = context.gl.TEXTURE_2D;

    /**
     * The width of this texture, in pixels.
     * 
     * @property width
     * @readOnly
     * @type {Number} the width
     */
    this.width = 0; //initialized on texture upload

    /**
     * The height of this texture, in pixels.
     * 
     * @property height
     * @readOnly
     * @type {Number} the height
     */
    this.height = 0; //initialized on texture upload

    // e.g. --> new Texture(gl, 256, 256, gl.RGB, gl.UNSIGNED_BYTE, data);
    //          creates a new empty texture, 256x256
    //    --> new Texture(gl);
    //        creates a new texture but WITHOUT uploading any data. 

    /**
     * The S wrap parameter.
     * @property {GLenum} wrapS
     */
    this.wrapS = Texture.DEFAULT_WRAP;
    /**
     * The T wrap parameter.
     * @property {GLenum} wrapT
     */
    this.wrapT = Texture.DEFAULT_WRAP;
    /**
     * The minifcation filter.
     * @property {GLenum} minFilter 
     */
    this.minFilter = Texture.DEFAULT_FILTER;
    
    /**
     * The magnification filter.
     * @property {GLenum} magFilter 
     */
    this.magFilter = Texture.DEFAULT_FILTER;

    /**
     * When a texture is created, we keep track of the arguments provided to 
     * its constructor. On context loss and restore, these arguments are re-supplied
     * to the Texture, so as to re-create it in its correct form.
     *
     * This is mainly useful if you are procedurally creating textures and passing
     * their data directly (e.g. for generic lookup tables in a shader). For image
     * or media based textures, it would be better to use an AssetManager to manage
     * the asynchronous texture upload.
     *
     * Upon destroying a texture, a reference to this is also lost.
     *
     * @property managedArgs
     * @type {Array} the array of arguments, shifted to exclude the WebGLContext parameter
     */
    this.managedArgs = Array.prototype.slice.call(arguments, 1);

    //This is maanged by WebGLContext
    this.context.addManagedObject(this);
    this.create();
  },

  /**
   * This can be called after creating a Texture to load an Image object asynchronously,
   * or upload image data directly. It takes the same parameters as the constructor, except 
   * for the context which has already been established. 
   *
   * Users will generally not need to call this directly. 
   * 
   * @protected
   * @method  setup
   */
  setup: function(width, height, format, dataType, data, genMipmaps) {
    var gl = this.gl;

    //If the first argument is a string, assume it's an Image loader
    //second argument will then be genMipmaps, third and fourth the success/fail callbacks
    if (typeof width === "string") {
      var img = new Image();
      var path      = arguments[0];   //first argument, the path
      var successCB = typeof arguments[1] === "function" ? arguments[1] : null;
      var failCB    = typeof arguments[2] === "function" ? arguments[2] : null;
      genMipmaps    = !!arguments[3];

      var self = this;

      //If you try to render a texture that is not yet "renderable" (i.e. the 
      //async load hasn't completed yet, which is always the case in Chrome since requestAnimationFrame
      //fires before img.onload), WebGL will throw us errors. So instead we will just upload some
      //dummy data until the texture load is complete. Users can disable this with the global flag.
      if (Texture.USE_DUMMY_1x1_DATA) {
        self.uploadData(1, 1);
        this.width = this.height = 0;
      }

      img.onload = function() {
        self.uploadImage(img, undefined, undefined, genMipmaps);
        if (successCB)
          successCB();
      }
      img.onerror = function() {
        // console.warn("Error loading image: "+path);
        if (genMipmaps) //we still need to gen mipmaps on the 1x1 dummy
          gl.generateMipmap(gl.TEXTURE_2D);
        if (failCB)
          failCB();
      }
      img.onabort = function() {
        // console.warn("Image load aborted: "+path);
        if (genMipmaps) //we still need to gen mipmaps on the 1x1 dummy
          gl.generateMipmap(gl.TEXTURE_2D);
        if (failCB)
          failCB();
      }

      img.src = path;
    } 
    //otherwise assume our regular list of width/height arguments are passed
    else {
      this.uploadData(width, height, format, dataType, data, genMipmaps);
    }
  },  

  /**
   * Called in the Texture constructor, and after the GL context has been re-initialized. 
   * Subclasses can override this to provide a custom data upload, e.g. cubemaps or compressed
   * textures.
   *
   * @method  create
   */
  create: function() {
    this.gl = this.context.gl; 
    var gl = this.gl;

    this.id = gl.createTexture(); //texture ID is recreated
    this.width = this.height = 0; //size is reset to zero until loaded
    this.target = gl.TEXTURE_2D;  //the provider can change this if necessary (e.g. cube maps)

    this.bind();


    //TODO: clean these up a little. 
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, Texture.UNPACK_PREMULTIPLY_ALPHA);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, Texture.UNPACK_ALIGNMENT);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, Texture.UNPACK_FLIP_Y);
    
    var colorspace = Texture.UNPACK_COLORSPACE_CONVERSION || gl.BROWSER_DEFAULT_WEBGL;
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, colorspace);

    //setup wrap modes without binding redundantly
    this.setWrap(this.wrapS, this.wrapT, false);
    this.setFilter(this.minFilter, this.magFilter, false);
    
    if (this.managedArgs.length !== 0) {
      this.setup.apply(this, this.managedArgs);
    }
  },

  /**
   * Destroys this texture by deleting the GL resource,
   * removing it from the WebGLContext management stack,
   * setting its size to zero, and id and managed arguments to null.
   * 
   * Trying to use this texture after may lead to undefined behaviour.
   *
   * @method  destroy
   */
  destroy: function() {
    if (this.id && this.gl)
      this.gl.deleteTexture(this.id);
    if (this.context)
      this.context.removeManagedObject(this);
    this.width = this.height = 0;
    this.id = null;
    this.managedArgs = null;
    this.context = null;
    this.gl = null;
  },

  /**
   * Sets the wrap mode for this texture; if the second argument
   * is undefined or falsy, then both S and T wrap will use the first
   * argument.
   *
   * You can use Texture.Wrap constants for convenience, to avoid needing 
   * a GL reference.
   *
   * @method  setWrap
   * @param {GLenum} s the S wrap mode
   * @param {GLenum} t the T wrap mode
   * @param {Boolean} ignoreBind (optional) if true, the bind will be ignored. 
   */
  setWrap: function(s, t, ignoreBind) { //TODO: support R wrap mode
    if (s && t) {
      this.wrapS = s;
      this.wrapT = t;
    } else 
      this.wrapS = this.wrapT = s;
    
    //enforce POT rules..
    this._checkPOT(); 

    if (!ignoreBind)
      this.bind();

    var gl = this.gl;
    gl.texParameteri(this.target, gl.TEXTURE_WRAP_S, this.wrapS);
    gl.texParameteri(this.target, gl.TEXTURE_WRAP_T, this.wrapT);
  },


  /**
   * Sets the min and mag filter for this texture; 
   * if mag is undefined or falsy, then both min and mag will use the
   * filter specified for min.
   *
   * You can use Texture.Filter constants for convenience, to avoid needing 
   * a GL reference.
   *
   * @method  setFilter
   * @param {GLenum} min the minification filter
   * @param {GLenum} mag the magnification filter
   * @param {Boolean} ignoreBind if true, the bind will be ignored. 
   */
  setFilter: function(min, mag, ignoreBind) { 
    if (min && mag) {
      this.minFilter = min;
      this.magFilter = mag;
    } else 
      this.minFilter = this.magFilter = min;
    
    //enforce POT rules..
    this._checkPOT();

    if (!ignoreBind)
      this.bind();

    var gl = this.gl;
    gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, this.minFilter);
    gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, this.magFilter);
  },

  /**
   * A low-level method to upload the specified ArrayBufferView
   * to this texture. This will cause the width and height of this
   * texture to change.
   *
   * @method  uploadData
   * @param  {Number} width          the new width of this texture,
   *                                 defaults to the last used width (or zero)
   * @param  {Number} height         the new height of this texture
   *                                 defaults to the last used height (or zero)
   * @param  {GLenum} format         the data format, default RGBA
   * @param  {GLenum} type           the data type, default UNSIGNED_BYTE (Uint8Array)
   * @param  {ArrayBufferView} data  the raw data for this texture, or null for an empty image
   * @param  {Boolean} genMipmaps    whether to generate mipmaps after uploading the data, default false
   */
  uploadData: function(width, height, format, type, data, genMipmaps) {
    var gl = this.gl;

    format = format || gl.RGBA;
    type = type || gl.UNSIGNED_BYTE;
    data = data || null; //make sure falsey value is null for texImage2D

    this.width = (width || width==0) ? width : this.width;
    this.height = (height || height==0) ? height : this.height;

    this._checkPOT();

    this.bind();

    gl.texImage2D(this.target, 0, format, 
            this.width, this.height, 0, format,
            type, data);

    if (genMipmaps)
      gl.generateMipmap(this.target);
  },

  /**
   * Uploads ImageData, HTMLImageElement, HTMLCanvasElement or 
   * HTMLVideoElement.
   *
   * @method  uploadImage
   * @param  {Object} domObject the DOM image container
   * @param  {GLenum} format the format, default gl.RGBA
   * @param  {GLenum} type the data type, default gl.UNSIGNED_BYTE
   * @param  {Boolean} genMipmaps whether to generate mipmaps after uploading the data, default false
   */
  uploadImage: function(domObject, format, type, genMipmaps) {
    var gl = this.gl;

    format = format || gl.RGBA;
    type = type || gl.UNSIGNED_BYTE;
    
    this.width = domObject.width;
    this.height = domObject.height;

    this._checkPOT();

    this.bind();

    gl.texImage2D(this.target, 0, format, format,
            type, domObject);

    if (genMipmaps)
      gl.generateMipmap(this.target);
  },

  /**
   * If FORCE_POT is false, we verify this texture to see if it is valid, 
   * as per non-power-of-two rules. If it is non-power-of-two, it must have 
   * a wrap mode of CLAMP_TO_EDGE, and the minification filter must be LINEAR
   * or NEAREST. If we don't satisfy these needs, an error is thrown.
   * 
   * @method  _checkPOT
   * @private
   * @return {[type]} [description]
   */
  _checkPOT: function() {
    if (!Texture.FORCE_POT) {
      //If minFilter is anything but LINEAR or NEAREST
      //or if wrapS or wrapT are not CLAMP_TO_EDGE...
      var wrongFilter = (this.minFilter !== Texture.Filter.LINEAR && this.minFilter !== Texture.Filter.NEAREST);
      var wrongWrap = (this.wrapS !== Texture.Wrap.CLAMP_TO_EDGE || this.wrapT !== Texture.Wrap.CLAMP_TO_EDGE);

      if ( wrongFilter || wrongWrap ) {
        if (!isPowerOfTwo(this.width) || !isPowerOfTwo(this.height))
          throw new Error(wrongFilter 
              ? "Non-power-of-two textures cannot use mipmapping as filter"
              : "Non-power-of-two textures must use CLAMP_TO_EDGE as wrap");
      }
    }
  },

  /**
   * Binds the texture. If unit is specified,
   * it will bind the texture at the given slot
   * (TEXTURE0, TEXTURE1, etc). If unit is not specified,
   * it will simply bind the texture at whichever slot
   * is currently active.
   *
   * @method  bind
   * @param  {Number} unit the texture unit index, starting at 0
   */
  bind: function(unit) {
    var gl = this.gl;
    if (unit || unit === 0)
      gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(this.target, this.id);
  },

  toString: function() {
    return this.id + ":" + this.width + "x" + this.height + "";
  }
});

/** 
 * A set of Filter constants that match their GL counterparts.
 * This is for convenience, to avoid the need for a GL rendering context.
 *
 * @example
 * ```
 *     Texture.Filter.NEAREST
 *     Texture.Filter.NEAREST_MIPMAP_LINEAR
 *     Texture.Filter.NEAREST_MIPMAP_NEAREST
 *     Texture.Filter.LINEAR
 *     Texture.Filter.LINEAR_MIPMAP_LINEAR
 *     Texture.Filter.LINEAR_MIPMAP_NEAREST
 * ```
 * @attribute Filter
 * @static
 * @type {Object}
 */
Texture.Filter = {
  NEAREST: 9728,
  NEAREST_MIPMAP_LINEAR: 9986,
  NEAREST_MIPMAP_NEAREST: 9984,
  LINEAR: 9729,
  LINEAR_MIPMAP_LINEAR: 9987,
  LINEAR_MIPMAP_NEAREST: 9985
};

/** 
 * A set of Wrap constants that match their GL counterparts.
 * This is for convenience, to avoid the need for a GL rendering context.
 *
 * @example
 * ```
 *     Texture.Wrap.CLAMP_TO_EDGE
 *     Texture.Wrap.MIRRORED_REPEAT
 *     Texture.Wrap.REPEAT
 * ```
 * @attribute Wrap
 * @static
 * @type {Object}
 */
Texture.Wrap = {
  CLAMP_TO_EDGE: 33071,
  MIRRORED_REPEAT: 33648,
  REPEAT: 10497
};

/** 
 * A set of Format constants that match their GL counterparts.
 * This is for convenience, to avoid the need for a GL rendering context.
 *
 * @example
 * ```
 *     Texture.Format.RGB
 *     Texture.Format.RGBA
 *     Texture.Format.LUMINANCE_ALPHA
 * ```
 * @attribute Format
 * @static
 * @type {Object}
 */
Texture.Format = {
  DEPTH_COMPONENT: 6402,
  ALPHA: 6406,
  RGBA: 6408,
  RGB: 6407,
  LUMINANCE: 6409,
  LUMINANCE_ALPHA: 6410
};

/** 
 * A set of DataType constants that match their GL counterparts.
 * This is for convenience, to avoid the need for a GL rendering context.
 *
 * @example
 * ```
 *     Texture.DataType.UNSIGNED_BYTE 
 *     Texture.DataType.FLOAT 
 * ```
 * @attribute DataType
 * @static
 * @type {Object}
 */
Texture.DataType = {
  BYTE: 5120,
  SHORT: 5122,
  INT: 5124,
  FLOAT: 5126,
  UNSIGNED_BYTE: 5121,
  UNSIGNED_INT: 5125,
  UNSIGNED_SHORT: 5123,
  UNSIGNED_SHORT_4_4_4_4: 32819,
  UNSIGNED_SHORT_5_5_5_1: 32820,
  UNSIGNED_SHORT_5_6_5: 33635
}

/**
 * The default wrap mode when creating new textures. If a custom 
 * provider was specified, it may choose to override this default mode.
 * 
 * @attribute {GLenum} DEFAULT_WRAP
 * @static 
 * @default  Texture.Wrap.CLAMP_TO_EDGE
 */
Texture.DEFAULT_WRAP = Texture.Wrap.CLAMP_TO_EDGE;


/**
 * The default filter mode when creating new textures. If a custom
 * provider was specified, it may choose to override this default mode.
 *
 * @attribute {GLenum} DEFAULT_FILTER
 * @static
 * @default  Texture.Filter.LINEAR
 */
Texture.DEFAULT_FILTER = Texture.Filter.NEAREST;

/**
 * By default, we do some error checking when creating textures
 * to ensure that they will be "renderable" by WebGL. Non-power-of-two
 * textures must use CLAMP_TO_EDGE as their wrap mode, and NEAREST or LINEAR
 * as their wrap mode. Further, trying to generate mipmaps for a NPOT image
 * will lead to errors. 
 *
 * However, you can disable this error checking by setting `FORCE_POT` to true.
 * This may be useful if you are running on specific hardware that supports POT 
 * textures, or in some future case where NPOT textures is added as a WebGL extension.
 * 
 * @attribute {Boolean} FORCE_POT
 * @static
 * @default  false
 */
Texture.FORCE_POT = false;

//default pixel store operations. Used in create()
Texture.UNPACK_FLIP_Y = false;
Texture.UNPACK_ALIGNMENT = 1;
Texture.UNPACK_PREMULTIPLY_ALPHA = true; 
Texture.UNPACK_COLORSPACE_CONVERSION = undefined;

//for the Image constructor we need to handle things a bit differently..
Texture.USE_DUMMY_1x1_DATA = true;

/**
 * Utility to get the number of components for the given GLenum, e.g. gl.RGBA returns 4.
 * Returns null if the specified format is not of type DEPTH_COMPONENT, ALPHA, LUMINANCE,
 * LUMINANCE_ALPHA, RGB, or RGBA.
 * 
 * @method getNumComponents
 * @static
 * @param  {GLenum} format a texture format, i.e. Texture.Format.RGBA
 * @return {Number} the number of components for this format
 */
Texture.getNumComponents = function(format) {
  switch (format) {
    case Texture.Format.DEPTH_COMPONENT:
    case Texture.Format.ALPHA:
    case Texture.Format.LUMINANCE:
      return 1;
    case Texture.Format.LUMINANCE_ALPHA:
      return 2;
    case Texture.Format.RGB:
      return 3;
    case Texture.Format.RGBA:
      return 4;
  }
  return null;
};

module.exports = Texture;
},{"klasse":10,"number-util":11,"signals":12}],4:[function(require,module,exports){
var Class = require('klasse');

//This is a GL-specific texture region, employing tangent space normalized coordinates U and V.
//A canvas-specific region would really just be a lightweight object with { x, y, width, height }
//in pixels.
var TextureRegion = new Class({

  initialize: function TextureRegion(texture, x, y, width, height) {
    this.texture = texture;
    this.setRegion(x, y, width, height);
  },

  setUVs: function(u, v, u2, v2) {
    this.regionWidth = Math.round(Math.abs(u2 - u) * this.texture.width);
        this.regionHeight = Math.round(Math.abs(v2 - v) * this.texture.height);

        // From LibGDX TextureRegion.java -- 
    // For a 1x1 region, adjust UVs toward pixel center to avoid filtering artifacts on AMD GPUs when drawing very stretched.
    if (this.regionWidth == 1 && this.regionHeight == 1) {
      var adjustX = 0.25 / this.texture.width;
      u += adjustX;
      u2 -= adjustX;
      var adjustY = 0.25 / this.texture.height;
      v += adjustY;
      v2 -= adjustY;
    }

    this.u = u;
    this.v = v;
    this.u2 = u2;
    this.v2 = v2;
  },

  setRegion: function(x, y, width, height) {
    x = x || 0;
    y = y || 0;
    width = (width===0 || width) ? width : this.texture.width;
    height = (height===0 || height) ? height : this.texture.height;

    var invTexWidth = 1 / this.texture.width;
    var invTexHeight = 1 / this.texture.height;
    this.setUVs(x * invTexWidth, y * invTexHeight, (x + width) * invTexWidth, (y + height) * invTexHeight);
    this.regionWidth = Math.abs(width);
    this.regionHeight = Math.abs(height);
  },

  /** Sets the texture to that of the specified region and sets the coordinates relative to the specified region. */
  setFromRegion: function(region, x, y, width, height) {
    this.texture = region.texture;
    this.set(region.getRegionX() + x, region.getRegionY() + y, width, height);
  },


  //TODO: add setters for regionX/Y and regionWidth/Height

  regionX: {
    get: function() {
      return Math.round(this.u * this.texture.width);
    } 
  },

  regionY: {
    get: function() {
      return Math.round(this.v * this.texture.height);
    }
  },

  flip: function(x, y) {
    var temp;
    if (x) {
      temp = this.u;
      this.u = this.u2;
      this.u2 = temp;
    }
    if (y) {
      temp = this.v;
      this.v = this.v2;
      this.v2 = temp;
    }
  }
});

module.exports = TextureRegion;
},{"klasse":10}],5:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');
var Signal = require('signals');

/**
 * A thin wrapper around WebGLRenderingContext which handles
 * context loss and restore with various rendering objects (textures,
 * shaders and buffers). This also handles general viewport management.
 *
 * If the view is not specified, a canvas will be created.
 *
 * If the `view` parameter is an instanceof WebGLRenderingContext,
 * we will use its canvas and context without fetching another through `getContext`.
 * Passing a canvas that has already had `getContext('webgl')` called will not cause
 * errors, but in certain debuggers (e.g. Chrome WebGL Inspector) only the latest
 * context will be traced.
 * 
 * @class  WebGLContext
 * @constructor
 * @param {Number} width the width of the GL canvas
 * @param {Number} height the height of the GL canvas
 * @param {HTMLCanvasElement} view the optional DOM canvas element
 * @param {Object} contextAttribuets an object containing context attribs which
 *                                   will be used during GL initialization
 */
var WebGLContext = new Class({
  
  initialize: function WebGLContext(width, height, view, contextAttributes) {
    /**
     * The list of rendering objects (shaders, VBOs, textures, etc) which are 
     * currently being managed. Any object with a "create" method can be added
     * to this list. Upon destroying the rendering object, it should be removed.
     * See addManagedObject and removeManagedObject.
     * 
     * @property {Array} managedObjects
     */
    this.managedObjects = [];

    /**
     * The actual GL context. You can use this for
     * raw GL calls or to access GLenum constants. This
     * will be updated on context restore. While the WebGLContext
     * is not `valid`, you should not try to access GL state.
     * 
     * @property gl
     * @type {WebGLRenderingContext}
     */
    this.gl = null;

    if (view && typeof window.WebGLRenderingContext !== "undefined"
         && view instanceof window.WebGLRenderingContext) {
      view = view.canvas;
      this.gl = view;
      this.valid = true;
      contextAttributes = undefined; //just ignore new attribs...
    }

    /**
     * The canvas DOM element for this context.
     * @property {Number} view
     */
    this.view = view || document.createElement("canvas");

    //default size as per spec:
    //http://www.w3.org/TR/2012/WD-html5-author-20120329/the-canvas-element.html#the-canvas-element
    
    /**
     * The width of this canvas.
     *
     * @property width
     * @type {Number}
     */
    this.width = this.view.width = width || 300;

    /**
     * The height of this canvas.
     * @property height
     * @type {Number}
     */
    this.height = this.view.height = height || 150;


    /**
     * The context attributes for initializing the GL state. This might include
     * anti-aliasing, alpha settings, verison, and so forth.
     * 
     * @property {Object} contextAttributes 
     */
    this.contextAttributes = contextAttributes;
    
    /**
     * Whether this context is 'valid', i.e. renderable. A context that has been lost
     * (and not yet restored) or destroyed is invalid.
     * 
     * @property {Boolean} valid
     */
    this.valid = false;

    /**
     * A signal dispatched when GL context is lost. 
     * 
     * The first argument passed to the listener is the WebGLContext
     * managing the context loss.
     * 
     * @event {Signal} lost
     */
    this.lost = new Signal();

    /**
     * A signal dispatched when GL context is restored, after all the managed
     * objects have been recreated.
     *
     * The first argument passed to the listener is the WebGLContext
     * which managed the restoration.
     *
     * This does not gaurentee that all objects will be renderable.
     * For example, a Texture with an ImageProvider may still be loading
     * asynchronously.   
     * 
     * @event {Signal} restored
     */
    this.restored = new Signal(); 
    
    //setup context lost and restore listeners
    this.view.addEventListener("webglcontextlost", function (ev) {
      ev.preventDefault();
      this._contextLost(ev);
    }.bind(this));
    this.view.addEventListener("webglcontextrestored", function (ev) {
      ev.preventDefault();
      this._contextRestored(ev);
    }.bind(this));
      
    if (!this.valid) //would only be valid if WebGLRenderingContext was passed 
      this._initContext();

    this.resize(this.width, this.height);
  },
  
  _initContext: function() {
    var err = "";
    this.valid = false;

    try {
      this.gl = (this.view.getContext('webgl', this.contextAttributes) 
            || this.view.getContext('experimental-webgl', this.contextAttributes));
    } catch (e) {
      this.gl = null;
    }

    if (this.gl) {
      this.valid = true;
    } else {
      throw "WebGL Context Not Supported -- try enabling it or using a different browser";
    } 
  },

  /**
   * Updates the width and height of this WebGL context, resizes
   * the canvas view, and calls gl.viewport() with the new size.
   * 
   * @param  {Number} width  the new width
   * @param  {Number} height the new height
   */
  resize: function(width, height) {
    this.width = width;
    this.height = height;

    this.view.width = width;
    this.view.height = height;

    var gl = this.gl;
    gl.viewport(0, 0, this.width, this.height);
  },

  /**
   * (internal use)
   * A managed object is anything with a "create" function, that will
   * restore GL state after context loss. 
   * 
   * @param {[type]} tex [description]
   */
  addManagedObject: function(obj) {
    this.managedObjects.push(obj);
  },

  /**
   * (internal use)
   * Removes a managed object from the cache. This is useful to destroy
   * a texture or shader, and have it no longer re-load on context restore.
   *
   * Returns the object that was removed, or null if it was not found in the cache.
   * 
   * @param  {Object} obj the object to be managed
   * @return {Object}     the removed object, or null
   */
  removeManagedObject: function(obj) {
    var idx = this.managedObjects.indexOf(obj);
    if (idx > -1) {
      this.managedObjects.splice(idx, 1);
      return obj;
    } 
    return null;
  },

  /**
   * Calls destroy() on each managed object, then removes references to these objects
   * and the GL rendering context. This also removes references to the view and sets
   * the context's width and height to zero.
   *
   * Attempting to use this WebGLContext or the GL rendering context after destroying it
   * will lead to undefined behaviour.
   */
  destroy: function() {
    for (var i=0; i<this.managedObjects.length; i++) {
      var obj = this.managedObjects[i];
      if (obj && typeof obj.destroy === "function")
        obj.destroy();
    }
    this.managedObjects.length = 0;
    this.valid = false;
    this.gl = null;
    this.view = null;
    this.width = this.height = 0;
  },

  _contextLost: function(ev) {
    //all textures/shaders/buffers/FBOs have been deleted... 
    //we need to re-create them on restore
    this.valid = false;

    this.lost.dispatch(this);
  },

  _contextRestored: function(ev) {
    //first, initialize the GL context again
    this._initContext();

    //now we recreate our shaders and textures
    for (var i=0; i<this.managedObjects.length; i++) {
      this.managedObjects[i].create();
    }

    //update GL viewport
    this.resize(this.width, this.height);

    this.restored.dispatch(this);
  }
});

module.exports = WebGLContext;
},{"klasse":10,"signals":12}],6:[function(require,module,exports){
var Class = require('klasse');
var Texture = require('../Texture');


var FrameBuffer = new Class({

  /**
   * Creates a new Frame Buffer Object with the given width and height.
   *
   * If width and height are non-numbers, this method expects the
   * first parameter to be a Texture object which should be acted upon. 
   * In this case, the FrameBuffer does not "own" the texture, and so it
   * won't dispose of it upon destruction. This is an advanced version of the
   * constructor that assumes the user is giving us a valid Texture that can be bound (i.e.
   * no async Image textures).
   *
   * @class  FrameBuffer
   * @constructor
   * @param  {[type]} width  [description]
   * @param  {[type]} height [description]
   * @param  {[type]} filter [description]
   * @return {[type]}        [description]
   */
  initialize: function FrameBuffer(context, width, height, format) { //TODO: depth component
    if (typeof context !== "object")
      throw "GL context not specified to FrameBuffer";
  

    /**
     * The underlying ID of the GL frame buffer object.
     *
     * @property {WebGLFramebuffer} id
     */   
    this.id = null;

    /**
     * The WebGLContext backed by this frame buffer.
     *
     * @property {WebGLContext} context
     */
    this.context = context;

    /**
     * The Texture backed by this frame buffer.
     *
     * @property {Texture} Texture
     */
    //this Texture is now managed.
    this.texture = new Texture(context, width, height, format);

    //This is maanged by WebGLContext
    this.context.addManagedObject(this);
    this.create();
  },

  /**
   * A read-only property which returns the width of the backing texture. 
   * 
   * @readOnly
   * @property width
   * @type {Number}
   */
  width: {
    get: function() {
      return this.texture.width
    }
  },

  /**
   * A read-only property which returns the height of the backing texture. 
   * 
   * @readOnly
   * @property height
   * @type {Number}
   */
  height: {
    get: function() {
      return this.texture.height;
    }
  },


  /**
   * Called during initialization to setup the frame buffer; also called on
   * context restore. Users will not need to call this directly.
   * 
   * @method create
   */
  create: function() {
    this.gl = this.context.gl; 
    var gl = this.gl;

    var tex = this.texture;

    //we assume the texture has already had create() called on it
    //since it was added as a managed object prior to this FrameBuffer
    tex.bind();
 
    this.id = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.id);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tex.target, tex.id, 0);

    var result = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (result != gl.FRAMEBUFFER_COMPLETE) {
      this.destroy(); //destroy our resources before leaving this function..

      var err = "Framebuffer not complete";
      switch (result) {
        case gl.FRAMEBUFFER_UNSUPPORTED:
          throw new Error(err + ": unsupported");
        case gl.INCOMPLETE_DIMENSIONS:
          throw new Error(err + ": incomplete dimensions");
        case gl.INCOMPLETE_ATTACHMENT:
          throw new Error(err + ": incomplete attachment");
        case gl.INCOMPLETE_MISSING_ATTACHMENT:
          throw new Error(err + ": missing attachment");
        default:
          throw new Error(err);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  },


  /**
   * Destroys this frame buffer. Using this object after destroying it will have
   * undefined results. 
   * @method destroy
   */
  destroy: function() {
    var gl = this.gl;

    if (this.texture)
      this.texture.destroy();
    if (this.id && this.gl)
      this.gl.deleteFramebuffer(this.id);
    if (this.context)
      this.context.removeManagedObject(this);

    this.id = null;
    this.gl = null;
    this.texture = null;
    this.context = null;
  },

  /**
   * Binds this framebuffer and sets the viewport to the expected size.
   * @method begin
   */
  begin: function() {
    var gl = this.gl;
    gl.viewport(0, 0, this.texture.width, this.texture.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.id);
  },

  /**
   * Binds the default frame buffer (the screen) and sets the viewport back
   * to the size of the WebGLContext.
   * 
   * @method end
   */
  end: function() {
    var gl = this.gl;
    gl.viewport(0, 0, this.context.width, this.context.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
});

module.exports = FrameBuffer;
},{"../Texture":3,"klasse":10}],7:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');

//TODO: decouple into VBO + IBO utilities 
/**
 * A mesh class that wraps VBO and IBO.
 *
 * @class  Mesh
 */
var Mesh = new Class({


  /**
   * A write-only property which sets both vertices and indices 
   * flag to dirty or not. 
   *
   * @property dirty
   * @type {Boolean}
   * @writeOnly
   */
  dirty: {
    set: function(val) {
      this.verticesDirty = val;
      this.indicesDirty = val;
    }
  },

  /**
   * Creates a new Mesh with the provided parameters.
   *
   * If numIndices is 0 or falsy, no index buffer will be used
   * and indices will be an empty ArrayBuffer and a null indexBuffer.
   * 
   * If isStatic is true, then vertexUsage and indexUsage will
   * be set to gl.STATIC_DRAW. Otherwise they will use gl.DYNAMIC_DRAW.
   * You may want to adjust these after initialization for further control.
   * 
   * @param  {WebGLContext}  context the context for management
   * @param  {Boolean} isStatic      a hint as to whether this geometry is static
   * @param  {[type]}  numVerts      [description]
   * @param  {[type]}  numIndices    [description]
   * @param  {[type]}  vertexAttribs [description]
   * @return {[type]}                [description]
   */
  initialize: function Mesh(context, isStatic, numVerts, numIndices, vertexAttribs) {
    if (typeof context !== "object")
      throw "GL context not specified to Mesh";
    if (!numVerts)
      throw "numVerts not specified, must be > 0";

    this.context = context;
    this.gl = context.gl;
    
    this.numVerts = null;
    this.numIndices = null;
    
    this.vertices = null;
    this.indices = null;
    this.vertexBuffer = null;
    this.indexBuffer = null;

    this.verticesDirty = true;
    this.indicesDirty = true;
    this.indexUsage = null;
    this.vertexUsage = null;

    /** 
     * @property
     * @private
     */
    this._vertexAttribs = null;

    /** 
     * The stride for one vertex _in bytes_. 
     * 
     * @property {Number} vertexStride
     */
    this.vertexStride = null;

    this.numVerts = numVerts;
    this.numIndices = numIndices || 0;
    this.vertexUsage = isStatic ? this.gl.STATIC_DRAW : this.gl.DYNAMIC_DRAW;
    this.indexUsage  = isStatic ? this.gl.STATIC_DRAW : this.gl.DYNAMIC_DRAW;
    this._vertexAttribs = vertexAttribs || [];
    
    this.indicesDirty = true;
    this.verticesDirty = true;

    //determine the vertex stride based on given attributes
    var totalNumComponents = 0;
    for (var i=0; i<this._vertexAttribs.length; i++)
      totalNumComponents += this._vertexAttribs[i].offsetCount;
    this.vertexStride = totalNumComponents * 4; // in bytes

    this.vertices = new Float32Array(this.numVerts);
    this.indices = new Uint16Array(this.numIndices);

    //add this VBO to the managed cache
    this.context.addManagedObject(this);

    this.create();
  },

  //recreates the buffers on context loss
  create: function() {
    this.gl = this.context.gl;
    var gl = this.gl;
    this.vertexBuffer = gl.createBuffer();

    //ignore index buffer if we haven't specified any
    this.indexBuffer = this.numIndices > 0
          ? gl.createBuffer()
          : null;

    this.dirty = true;
  },

  destroy: function() {
    this.vertices = null;
    this.indices = null;
    if (this.vertexBuffer && this.gl)
      this.gl.deleteBuffer(this.vertexBuffer);
    if (this.indexBuffer && this.gl)
      this.gl.deleteBuffer(this.indexBuffer);
    this.vertexBuffer = null;
    this.indexBuffer = null;
    if (this.context)
      this.context.removeManagedObject(this);
    this.gl = null;
    this.context = null;
  },

  _updateBuffers: function(ignoreBind, subDataLength) {
    var gl = this.gl;

    //bind our index data, if we have any
    if (this.numIndices > 0) {
      if (!ignoreBind)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

      //update the index data
      if (this.indicesDirty) {
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, this.indexUsage);
        this.indicesDirty = false;
      }
    }

    //bind our vertex data
    if (!ignoreBind)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

    //update our vertex data
    if (this.verticesDirty) {
      if (subDataLength) {
        // TODO: When decoupling VBO/IBO be sure to give better subData support..
        var view = this.vertices.subarray(0, subDataLength);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, view);
      } else {
        gl.bufferData(gl.ARRAY_BUFFER, this.vertices, this.vertexUsage);  
      }

      
      this.verticesDirty = false;
    }
  },

  draw: function(primitiveType, count, offset, subDataLength) {
    if (count === 0)
      return;

    var gl = this.gl;
    
    offset = offset || 0;

    //binds and updates our buffers. pass ignoreBind as true
    //to avoid binding unnecessarily
    this._updateBuffers(true, subDataLength);

    if (this.numIndices > 0) { 
      gl.drawElements(primitiveType, count, 
            gl.UNSIGNED_SHORT, offset * 2); //* Uint16Array.BYTES_PER_ELEMENT
    } else
      gl.drawArrays(primitiveType, offset, count);
  },

  //binds this mesh's vertex attributes for the given shader
  bind: function(shader) {
    var gl = this.gl;

    var offset = 0;
    var stride = this.vertexStride;

    //bind and update our vertex data before binding attributes
    this._updateBuffers();

    //for each attribtue
    for (var i=0; i<this._vertexAttribs.length; i++) {
      var a = this._vertexAttribs[i];

      //location of the attribute
      var loc = a.location === null 
          ? shader.getAttributeLocation(a.name)
          : a.location;

      //TODO: We may want to skip unfound attribs
      // if (loc!==0 && !loc)
      //  console.warn("WARN:", a.name, "is not enabled");

      //first, enable the vertex array
      gl.enableVertexAttribArray(loc);

      //then specify our vertex format
      gl.vertexAttribPointer(loc, a.numComponents, a.type || gl.FLOAT, 
                   a.normalize, stride, offset);

      //and increase the offset...
      offset += a.offsetCount * 4; //in bytes
    }
  },

  unbind: function(shader) {
    var gl = this.gl;

    //for each attribtue
    for (var i=0; i<this._vertexAttribs.length; i++) {
      var a = this._vertexAttribs[i];

      //location of the attribute
      var loc = a.location === null 
          ? shader.getAttributeLocation(a.name)
          : a.location;

      //first, enable the vertex array
      gl.disableVertexAttribArray(loc);
    }
  }
});

Mesh.Attrib = new Class({

  name: null,
  numComponents: null,
  location: null,
  type: null,

  /**
   * Location is optional and for advanced users that
   * want vertex arrays to match across shaders. Any non-numerical
   * value will be converted to null, and ignored. If a numerical
   * value is given, it will override the position of this attribute
   * when given to a mesh.
   * 
   * @param  {[type]} name          [description]
   * @param  {[type]} numComponents [description]
   * @param  {[type]} location      [description]
   * @return {[type]}               [description]
   */
  initialize: function(name, numComponents, location, type, normalize, offsetCount) {
    this.name = name;
    this.numComponents = numComponents;
    this.location = typeof location === "number" ? location : null;
    this.type = type;
    this.normalize = Boolean(normalize);
    this.offsetCount = typeof offsetCount === "number" ? offsetCount : this.numComponents;
  }
})


module.exports = Mesh;
},{"klasse":10}],8:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');


var ShaderProgram = new Class({
  
  /**
   * Creates a new ShaderProgram from the given source, and an optional map of attribute
   * locations as <name, index> pairs.
   *
   * _Note:_ Chrome version 31 was giving me issues with attribute locations -- you may
   * want to omit this to let the browser pick the locations for you. 
   *
   * @class  ShaderProgram
   * @constructor
   * @param  {WebGLContext} context      the context to manage this object
   * @param  {String} vertSource         the vertex shader source
   * @param  {String} fragSource         the fragment shader source
   * @param  {Object} attributeLocations the attribute locations
   */
  initialize: function ShaderProgram(context, vertSource, fragSource, attributeLocations) {
    if (!vertSource || !fragSource)
      throw "vertex and fragment shaders must be defined";
    if (typeof context !== "object")
      throw "GL context not specified to ShaderProgram";
    this.context = context;

    this.vertShader = null;
    this.fragShader = null;
    this.program = null;
    this.log = "";

    this.uniformCache = null;
    this.attributeCache = null;

    this.attributeLocations = attributeLocations;

    //We trim (ECMAScript5) so that the GLSL line numbers are
    //accurate on shader log
    this.vertSource = vertSource.trim();
    this.fragSource = fragSource.trim();

    //Adds this shader to the context, to be managed
    this.context.addManagedObject(this);

    this.create();
  },

  /** 
   * This is called during the ShaderProgram constructor,
   * and may need to be called again after context loss and restore.
   * 
   * @method  create
   */
  create: function() {
    this.gl = this.context.gl;
    this._compileShaders();
  },

  //Compiles the shaders, throwing an error if the program was invalid.
  _compileShaders: function() {
    var gl = this.gl; 
    
    this.log = "";

    this.vertShader = this._loadShader(gl.VERTEX_SHADER, this.vertSource);
    this.fragShader = this._loadShader(gl.FRAGMENT_SHADER, this.fragSource);

    if (!this.vertShader || !this.fragShader)
      throw "Error returned when calling createShader";

    this.program = gl.createProgram();

    gl.attachShader(this.program, this.vertShader);
    gl.attachShader(this.program, this.fragShader);
  
    //TODO: This seems not to be working on my OSX -- maybe a driver bug?
    if (this.attributeLocations) {
      for (var key in this.attributeLocations) {
        if (this.attributeLocations.hasOwnProperty(key)) {
          gl.bindAttribLocation(this.program, Math.floor(this.attributeLocations[key]), key);
        }
      }
    }

    gl.linkProgram(this.program); 

    this.log += gl.getProgramInfoLog(this.program) || "";

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw "Error linking the shader program:\n"
        + this.log;
    }

    this._fetchUniforms();
    this._fetchAttributes();
  },

  _fetchUniforms: function() {
    var gl = this.gl;

    this.uniformCache = {};

    var len = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
    if (!len) //null or zero
      return;

    for (var i=0; i<len; i++) {
      var info = gl.getActiveUniform(this.program, i);
      if (info === null) 
        continue;
      var name = info.name;
      var location = gl.getUniformLocation(this.program, name);
      
      this.uniformCache[name] = {
        size: info.size,
        type: info.type,
        location: location
      };
    }
  },

  _fetchAttributes: function() { 
    var gl = this.gl; 

    this.attributeCache = {};

    var len = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
    if (!len) //null or zero
      return; 

    for (var i=0; i<len; i++) {
      var info = gl.getActiveAttrib(this.program, i);
      if (info === null) 
        continue;
      var name = info.name;

      //the attrib location is a simple index
      var location = gl.getAttribLocation(this.program, name);
      
      this.attributeCache[name] = {
        size: info.size,
        type: info.type,
        location: location
      };
    }
  },

  _loadShader: function(type, source) {
    var gl = this.gl;

    var shader = gl.createShader(type);
    if (!shader) //should not occur...
      return -1;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    var logResult = gl.getShaderInfoLog(shader) || "";
    if (logResult) {
      //we do this so the user knows which shader has the error
      var typeStr = (type === gl.VERTEX_SHADER) ? "vertex" : "fragment";
      logResult = "Error compiling "+ typeStr+ " shader:\n"+logResult;
    }

    this.log += logResult;

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) ) {
      throw this.log;
    }
    return shader;
  },

  /**
   * Called to bind this shader. Note that there is no "unbind" since
   * technically such a thing is not possible in the programmable pipeline.
   *
   * You must bind a shader before settings its uniforms.
   * 
   * @method bind
   */
  bind: function() {
    this.gl.useProgram(this.program);
  },


  /**
   * Destroys this shader and its resources. You should not try to use this
   * after destroying it.
   * @method  destroy
   */
  destroy: function() {
    if (this.context)
      this.context.removeManagedObject(this);

    if (this.gl && this.program) {
      var gl = this.gl;
      gl.detachShader(this.program, this.vertShader);
      gl.detachShader(this.program, this.fragShader);

      gl.deleteShader(this.vertShader);
      gl.deleteShader(this.fragShader);
      gl.deleteProgram(this.program);
    }
    this.attributeCache = null;
    this.uniformCache = null;
    this.vertShader = null;
    this.fragShader = null;
    this.program = null;
    this.gl = null;
    this.context = null;
  },


  /**
   * Returns the cached uniform info (size, type, location).
   * If the uniform is not found in the cache, it is assumed
   * to not exist, and this method returns null.
   *
   * This may return null even if the uniform is defined in GLSL:
   * if it is _inactive_ (i.e. not used in the program) then it may
   * be optimized out.
   *
   * @method  getUniformInfo
   * @param  {String} name the uniform name as defined in GLSL
   * @return {Object} an object containing location, size, and type
   */
  getUniformInfo: function(name) {
    return this.uniformCache[name] || null; 
  },

  /**
   * Returns the cached attribute info (size, type, location).
   * If the attribute is not found in the cache, it is assumed
   * to not exist, and this method returns null.
   *
   * This may return null even if the attribute is defined in GLSL:
   * if it is _inactive_ (i.e. not used in the program or disabled) 
   * then it may be optimized out.
   *
   * @method  getAttributeInfo
   * @param  {String} name the attribute name as defined in GLSL
   * @return {object} an object containing location, size and type
   */
  getAttributeInfo: function(name) {
    return this.attributeCache[name] || null; 
  },


  /**
   * Returns the cached uniform location object.
   * If the uniform is not found, this method returns null.
   *
   * @method  getAttributeLocation
   * @param  {String} name the uniform name as defined in GLSL
   * @return {GLint} the location object
   */
  getAttributeLocation: function(name) { //TODO: make faster, don't cache
    var info = this.getAttributeInfo(name);
    return info ? info.location : null;
  },

  /**
   * Returns the cached uniform location object, assuming it exists
   * and is active. Note that uniforms may be inactive if 
   * the GLSL compiler deemed them unused.
   *
   * @method  getUniformLocation
   * @param  {String} name the uniform name as defined in GLSL
   * @return {WebGLUniformLocation} the location object
   */
  getUniformLocation: function(name) {
    var info = this.getUniformInfo(name);
    return info ? info.location : null;
  },

  /**
   * Returns true if the uniform is active and found in this
   * compiled program. Note that uniforms may be inactive if 
   * the GLSL compiler deemed them unused.
   *
   * @method  hasUniform
   * @param  {String}  name the uniform name
   * @return {Boolean} true if the uniform is found and active
   */
  hasUniform: function(name) {
    return this.getUniformInfo(name) !== null;
  },

  /**
   * Returns true if the attribute is active and found in this
   * compiled program.
   *
   * @method  hasAttribute
   * @param  {String}  name the attribute name
   * @return {Boolean} true if the attribute is found and active
   */
  hasAttribute: function(name) {
    return this.getAttributeInfo(name) !== null;
  },

  /**
   * Returns the uniform value by name.
   *
   * @method  getUniform
   * @param  {String} name the uniform name as defined in GLSL
   * @return {any} The value of the WebGL uniform
   */
  getUniform: function(name) {
    return this.gl.getUniform(this.program, this.getUniformLocation(name));
  },

  /**
   * Returns the uniform value at the specified WebGLUniformLocation.
   *
   * @method  getUniformAt
   * @param  {WebGLUniformLocation} location the location object
   * @return {any} The value of the WebGL uniform
   */
  getUniformAt: function(location) {
    return this.gl.getUniform(this.program, location);
  },

  /**
   * A convenience method to set uniformi from the given arguments.
   * We determine which GL call to make based on the number of arguments
   * passed. For example, `setUniformi("var", 0, 1)` maps to `gl.uniform2i`.
   * 
   * @method  setUniformi
   * @param {String} name           the name of the uniform
   * @param {GLint} x  the x component for ints
   * @param {GLint} y  the y component for ivec2
   * @param {GLint} z  the z component for ivec3
   * @param {GLint} w  the w component for ivec4
   */
  setUniformi: function(name, x, y, z, w) {
    'use strict';
    var gl = this.gl;
    var loc = this.getUniformLocation(name);
    if (loc === null)
      return false;
    switch (arguments.length) {
      case 2: gl.uniform1i(loc, x); return true;
      case 3: gl.uniform2i(loc, x, y); return true;
      case 4: gl.uniform3i(loc, x, y, z); return true;
      case 5: gl.uniform4i(loc, x, y, z, w); return true;
      default:
        throw "invalid arguments to setUniformi"; 
    }
  },

  /**
   * A convenience method to set uniformf from the given arguments.
   * We determine which GL call to make based on the number of arguments
   * passed. For example, `setUniformf("var", 0, 1)` maps to `gl.uniform2f`.
   * 
   * @method  setUniformf
   * @param {String} name           the name of the uniform
   * @param {GLfloat} x  the x component for floats
   * @param {GLfloat} y  the y component for vec2
   * @param {GLfloat} z  the z component for vec3
   * @param {GLfloat} w  the w component for vec4
   */
  setUniformf: function(name, x, y, z, w) {
    'use strict';
    var gl = this.gl;
    var loc = this.getUniformLocation(name);
    if (loc === null)
      return false;
    switch (arguments.length) {
      case 2: gl.uniform1f(loc, x); return true;
      case 3: gl.uniform2f(loc, x, y); return true;
      case 4: gl.uniform3f(loc, x, y, z); return true;
      case 5: gl.uniform4f(loc, x, y, z, w); return true;
      default:
        throw "invalid arguments to setUniformf"; 
    }
  },

  //I guess we won't support sequence<GLfloat> .. whatever that is ??
  

  ///// 
  
  /**
   * A convenience method to set uniformNfv from the given ArrayBuffer.
   * We determine which GL call to make based on the length of the array 
   * buffer (for 1-4 component vectors stored in a Float32Array). To use
   * this method to upload data to uniform arrays, you need to specify the
   * 'count' parameter; i.e. the data type you are using for that array. If
   * specified, this will dictate whether to call uniform1fv, uniform2fv, etc.
   *
   * @method  setUniformfv
   * @param {String} name           the name of the uniform
   * @param {ArrayBuffer} arrayBuffer the array buffer
   * @param {Number} count            optional, the explicit data type count, e.g. 2 for vec2
   */
  setUniformfv: function(name, arrayBuffer, count) {
    'use strict';
    count = count || arrayBuffer.length;
    var gl = this.gl;
    var loc = this.getUniformLocation(name);
    if (loc === null)
      return false;
    switch (count) {
      case 1: gl.uniform1fv(loc, arrayBuffer); return true;
      case 2: gl.uniform2fv(loc, arrayBuffer); return true;
      case 3: gl.uniform3fv(loc, arrayBuffer); return true;
      case 4: gl.uniform4fv(loc, arrayBuffer); return true;
      default:
        throw "invalid arguments to setUniformf"; 
    }
  },

  /**
   * A convenience method to set uniformNiv from the given ArrayBuffer.
   * We determine which GL call to make based on the length of the array 
   * buffer (for 1-4 component vectors stored in a int array). To use
   * this method to upload data to uniform arrays, you need to specify the
   * 'count' parameter; i.e. the data type you are using for that array. If
   * specified, this will dictate whether to call uniform1fv, uniform2fv, etc.
   *
   * @method  setUniformiv
   * @param {String} name           the name of the uniform
   * @param {ArrayBuffer} arrayBuffer the array buffer
   * @param {Number} count            optional, the explicit data type count, e.g. 2 for ivec2
   */
  setUniformiv: function(name, arrayBuffer, count) {
    'use strict';
    count = count || arrayBuffer.length;
    var gl = this.gl;
    var loc = this.getUniformLocation(name);
    if (loc === null)
      return false;
    switch (count) {
      case 1: gl.uniform1iv(loc, arrayBuffer); return true;
      case 2: gl.uniform2iv(loc, arrayBuffer); return true;
      case 3: gl.uniform3iv(loc, arrayBuffer); return true;
      case 4: gl.uniform4iv(loc, arrayBuffer); return true;
      default:
        throw "invalid arguments to setUniformf"; 
    }
  },

  /**
   * This is a convenience function to pass a Matrix3 (from vecmath,
   * kami's preferred math library) or a Float32Array (e.g. gl-matrix)
   * to a shader. If mat is an object with "val", it is considered to be
   * a Matrix3, otherwise assumed to be a typed array being passed directly
   * to the shader.
   * 
   * @param {String} name the uniform name
   * @param {Matrix3|Float32Array} mat a Matrix3 or Float32Array
   * @param {Boolean} transpose whether to transpose the matrix, default false
   */
  setUniformMatrix3: function(name, mat, transpose) {
    'use strict';
    var arr = typeof mat === "object" && mat.val ? mat.val : mat;
    transpose = !!transpose; //to boolean

    var gl = this.gl;
    var loc = this.getUniformLocation(name);
    if (loc === null)
      return false;
    gl.uniformMatrix3fv(loc, transpose, arr)
  },

  /**
   * This is a convenience function to pass a Matrix4 (from vecmath,
   * kami's preferred math library) or a Float32Array (e.g. gl-matrix)
   * to a shader. If mat is an object with "val", it is considered to be
   * a Matrix4, otherwise assumed to be a typed array being passed directly
   * to the shader.
   * 
   * @param {String} name the uniform name
   * @param {Matrix4|Float32Array} mat a Matrix4 or Float32Array
   * @param {Boolean} transpose whether to transpose the matrix, default false
   */
  setUniformMatrix4: function(name, mat, transpose) {
    'use strict';
    var arr = typeof mat === "object" && mat.val ? mat.val : mat;
    transpose = !!transpose; //to boolean

    var gl = this.gl;
    var loc = this.getUniformLocation(name);
    if (loc === null)
      return false;
    gl.uniformMatrix4fv(loc, transpose, arr)
  } 
 
});

//Some default attribute names that parts of kami will use
//when creating a standard shader.
ShaderProgram.POSITION_ATTRIBUTE = "Position";
ShaderProgram.NORMAL_ATTRIBUTE = "Normal";
ShaderProgram.COLOR_ATTRIBUTE = "Color";
ShaderProgram.TEXCOORD_ATTRIBUTE = "TexCoord";

module.exports = ShaderProgram;
},{"klasse":10}],9:[function(require,module,exports){
/**
  Auto-generated Kami index file.
  Dependencies are placed on the top-level namespace, for convenience.
  Created on 2014-06-11.
*/
module.exports = {
    //core classes
    'BaseBatch':       require('./BaseBatch.js'),
    'SpriteBatch':     require('./SpriteBatch.js'),
    'Texture':         require('./Texture.js'),
    'TextureRegion':   require('./TextureRegion.js'),
    'WebGLContext':    require('./WebGLContext.js'),
    'FrameBuffer':     require('./glutils/FrameBuffer.js'),
    'Mesh':            require('./glutils/Mesh.js'),
    'ShaderProgram':   require('./glutils/ShaderProgram.js'),

    //signals dependencies
    'Signal':          require('signals').Signal,

    //klasse dependencies
    'Class':           require('klasse'),

    //number-util dependencies
    'NumberUtil':      require('number-util')
};
},{"./BaseBatch.js":1,"./SpriteBatch.js":2,"./Texture.js":3,"./TextureRegion.js":4,"./WebGLContext.js":5,"./glutils/FrameBuffer.js":6,"./glutils/Mesh.js":7,"./glutils/ShaderProgram.js":8,"klasse":10,"number-util":11,"signals":12}],10:[function(require,module,exports){
function hasGetterOrSetter(def) {
  return (!!def.get && typeof def.get === "function") || (!!def.set && typeof def.set === "function");
}

function getProperty(definition, k, isClassDescriptor) {
  //This may be a lightweight object, OR it might be a property
  //that was defined previously.
  
  //For simple class descriptors we can just assume its NOT previously defined.
  var def = isClassDescriptor 
        ? definition[k] 
        : Object.getOwnPropertyDescriptor(definition, k);

  if (!isClassDescriptor && def.value && typeof def.value === "object") {
    def = def.value;
  }


  //This might be a regular property, or it may be a getter/setter the user defined in a class.
  if ( def && hasGetterOrSetter(def) ) {
    if (typeof def.enumerable === "undefined")
      def.enumerable = true;
    if (typeof def.configurable === "undefined")
      def.configurable = true;
    return def;
  } else {
    return false;
  }
}

function hasNonConfigurable(obj, k) {
  var prop = Object.getOwnPropertyDescriptor(obj, k);
  if (!prop)
    return false;

  if (prop.value && typeof prop.value === "object")
    prop = prop.value;

  if (prop.configurable === false) 
    return true;

  return false;
}

//TODO: On create, 
//    On mixin, 

function extend(ctor, definition, isClassDescriptor, extend) {
  for (var k in definition) {
    if (!definition.hasOwnProperty(k))
      continue;

    var def = getProperty(definition, k, isClassDescriptor);

    if (def !== false) {
      //If Extends is used, we will check its prototype to see if 
      //the final variable exists.
      
      var parent = extend || ctor;
      if (hasNonConfigurable(parent.prototype, k)) {

        //just skip the final property
        if (Class.ignoreFinals)
          continue;

        //We cannot re-define a property that is configurable=false.
        //So we will consider them final and throw an error. This is by
        //default so it is clear to the developer what is happening.
        //You can set ignoreFinals to true if you need to extend a class
        //which has configurable=false; it will simply not re-define final properties.
        throw new Error("cannot override final property '"+k
              +"', set Class.ignoreFinals = true to skip");
      }

      Object.defineProperty(ctor.prototype, k, def);
    } else {
      ctor.prototype[k] = definition[k];
    }

  }
}

/**
 */
function mixin(myClass, mixins) {
  if (!mixins)
    return;

  if (!Array.isArray(mixins))
    mixins = [mixins];

  for (var i=0; i<mixins.length; i++) {
    extend(myClass, mixins[i].prototype || mixins[i]);
  }
}

/**
 * Creates a new class with the given descriptor.
 * The constructor, defined by the name `initialize`,
 * is an optional function. If unspecified, an anonymous
 * function will be used which calls the parent class (if
 * one exists). 
 *
 * You can also use `Extends` and `Mixins` to provide subclassing
 * and inheritance.
 *
 * @class  Class
 * @constructor
 * @param {Object} definition a dictionary of functions for the class
 * @example
 *
 *    var MyClass = new Class({
 *    
 *      initialize: function() {
 *        this.foo = 2.0;
 *      },
 *
 *      bar: function() {
 *        return this.foo + 5;
 *      }
 *    });
 */
function Class(definition) {
  if (!definition)
    definition = {};

  //The variable name here dictates what we see in Chrome debugger
  var initialize;
  var Extends;

  if (definition.initialize) {
    if (typeof definition.initialize !== "function")
      throw new Error("initialize must be a function");
    initialize = definition.initialize;

    //Usually we should avoid "delete" in V8 at all costs.
    //However, its unlikely to make any performance difference
    //here since we only call this on class creation (i.e. not object creation).
    delete definition.initialize;
  } else {
    if (definition.Extends) {
      var base = definition.Extends;
      initialize = function () {
        base.apply(this, arguments);
      }; 
    } else {
      initialize = function () {}; 
    }
  }

  if (definition.Extends) {
    initialize.prototype = Object.create(definition.Extends.prototype);
    initialize.prototype.constructor = initialize;
    //for getOwnPropertyDescriptor to work, we need to act
    //directly on the Extends (or Mixin)
    Extends = definition.Extends;
    delete definition.Extends;
  } else {
    initialize.prototype.constructor = initialize;
  }

  //Grab the mixins, if they are specified...
  var mixins = null;
  if (definition.Mixins) {
    mixins = definition.Mixins;
    delete definition.Mixins;
  }

  //First, mixin if we can.
  mixin(initialize, mixins);

  //Now we grab the actual definition which defines the overrides.
  extend(initialize, definition, true, Extends);

  return initialize;
};

Class.extend = extend;
Class.mixin = mixin;
Class.ignoreFinals = false;

module.exports = Class;
},{}],11:[function(require,module,exports){
var int8 = new Int8Array(4);
var int32 = new Int32Array(int8.buffer, 0, 1);
var float32 = new Float32Array(int8.buffer, 0, 1);

/**
 * A singleton for number utilities. 
 * @class NumberUtil
 */
var NumberUtil = function() {

};


/**
 * Returns a float representation of the given int bits. ArrayBuffer
 * is used for the conversion.
 *
 * @method  intBitsToFloat
 * @static
 * @param  {Number} i the int to cast
 * @return {Number}   the float
 */
NumberUtil.intBitsToFloat = function(i) {
  int32[0] = i;
  return float32[0];
};

/**
 * Returns the int bits from the given float. ArrayBuffer is used
 * for the conversion.
 *
 * @method  floatToIntBits
 * @static
 * @param  {Number} f the float to cast
 * @return {Number}   the int bits
 */
NumberUtil.floatToIntBits = function(f) {
  float32[0] = f;
  return int32[0];
};

/**
 * Encodes ABGR int as a float, with slight precision loss.
 *
 * @method  intToFloatColor
 * @static
 * @param {Number} value an ABGR packed integer
 */
NumberUtil.intToFloatColor = function(value) {
  return NumberUtil.intBitsToFloat( value & 0xfeffffff );
};

/**
 * Returns a float encoded ABGR value from the given RGBA
 * bytes (0 - 255). Useful for saving bandwidth in vertex data.
 *
 * @method  colorToFloat
 * @static
 * @param {Number} r the Red byte (0 - 255)
 * @param {Number} g the Green byte (0 - 255)
 * @param {Number} b the Blue byte (0 - 255)
 * @param {Number} a the Alpha byte (0 - 255)
 * @return {Float32}  a Float32 of the RGBA color
 */
NumberUtil.colorToFloat = function(r, g, b, a) {
  var bits = (a << 24 | b << 16 | g << 8 | r);
  return NumberUtil.intToFloatColor(bits);
};

/**
 * Returns true if the number is a power-of-two.
 *
 * @method  isPowerOfTwo
 * @param  {Number}  n the number to test
 * @return {Boolean}   true if power-of-two
 */
NumberUtil.isPowerOfTwo = function(n) {
  return (n & (n - 1)) == 0;
};

/**
 * Returns the next highest power-of-two from the specified number. 
 * 
 * @param  {Number} n the number to test
 * @return {Number}   the next highest power of two
 */
NumberUtil.nextPowerOfTwo = function(n) {
  n--;
  n |= n >> 1;
  n |= n >> 2;
  n |= n >> 4;
  n |= n >> 8;
  n |= n >> 16;
  return n+1;
};

module.exports = NumberUtil;
},{}],12:[function(require,module,exports){
/*jslint onevar:true, undef:true, newcap:true, regexp:true, bitwise:true, maxerr:50, indent:4, white:false, nomen:false, plusplus:false */
/*global define:false, require:false, exports:false, module:false, signals:false */

/** @license
 * JS Signals <http://millermedeiros.github.com/js-signals/>
 * Released under the MIT license
 * Author: Miller Medeiros
 * Version: 1.0.0 - Build: 268 (2012/11/29 05:48 PM)
 */

(function(global){

    // SignalBinding -------------------------------------------------
    //================================================================

    /**
     * Object that represents a binding between a Signal and a listener function.
     * <br />- <strong>This is an internal constructor and shouldn't be called by regular users.</strong>
     * <br />- inspired by Joa Ebert AS3 SignalBinding and Robert Penner's Slot classes.
     * @author Miller Medeiros
     * @constructor
     * @internal
     * @name SignalBinding
     * @param {Signal} signal Reference to Signal object that listener is currently bound to.
     * @param {Function} listener Handler function bound to the signal.
     * @param {boolean} isOnce If binding should be executed just once.
     * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
     * @param {Number} [priority] The priority level of the event listener. (default = 0).
     */
    function SignalBinding(signal, listener, isOnce, listenerContext, priority) {

        /**
         * Handler function bound to the signal.
         * @type Function
         * @private
         */
        this._listener = listener;

        /**
         * If binding should be executed just once.
         * @type boolean
         * @private
         */
        this._isOnce = isOnce;

        /**
         * Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @memberOf SignalBinding.prototype
         * @name context
         * @type Object|undefined|null
         */
        this.context = listenerContext;

        /**
         * Reference to Signal object that listener is currently bound to.
         * @type Signal
         * @private
         */
        this._signal = signal;

        /**
         * Listener priority
         * @type Number
         * @private
         */
        this._priority = priority || 0;
    }

    SignalBinding.prototype = {

        /**
         * If binding is active and should be executed.
         * @type boolean
         */
        active : true,

        /**
         * Default parameters passed to listener during `Signal.dispatch` and `SignalBinding.execute`. (curried parameters)
         * @type Array|null
         */
        params : null,

        /**
         * Call listener passing arbitrary parameters.
         * <p>If binding was added using `Signal.addOnce()` it will be automatically removed from signal dispatch queue, this method is used internally for the signal dispatch.</p>
         * @param {Array} [paramsArr] Array of parameters that should be passed to the listener
         * @return {*} Value returned by the listener.
         */
        execute : function (paramsArr) {
            var handlerReturn, params;
            if (this.active && !!this._listener) {
                params = this.params? this.params.concat(paramsArr) : paramsArr;
                handlerReturn = this._listener.apply(this.context, params);
                if (this._isOnce) {
                    this.detach();
                }
            }
            return handlerReturn;
        },

        /**
         * Detach binding from signal.
         * - alias to: mySignal.remove(myBinding.getListener());
         * @return {Function|null} Handler function bound to the signal or `null` if binding was previously detached.
         */
        detach : function () {
            return this.isBound()? this._signal.remove(this._listener, this.context) : null;
        },

        /**
         * @return {Boolean} `true` if binding is still bound to the signal and have a listener.
         */
        isBound : function () {
            return (!!this._signal && !!this._listener);
        },

        /**
         * @return {boolean} If SignalBinding will only be executed once.
         */
        isOnce : function () {
            return this._isOnce;
        },

        /**
         * @return {Function} Handler function bound to the signal.
         */
        getListener : function () {
            return this._listener;
        },

        /**
         * @return {Signal} Signal that listener is currently bound to.
         */
        getSignal : function () {
            return this._signal;
        },

        /**
         * Delete instance properties
         * @private
         */
        _destroy : function () {
            delete this._signal;
            delete this._listener;
            delete this.context;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[SignalBinding isOnce:' + this._isOnce +', isBound:'+ this.isBound() +', active:' + this.active + ']';
        }

    };


/*global SignalBinding:false*/

    // Signal --------------------------------------------------------
    //================================================================

    function validateListener(listener, fnName) {
        if (typeof listener !== 'function') {
            throw new Error( 'listener is a required param of {fn}() and should be a Function.'.replace('{fn}', fnName) );
        }
    }

    /**
     * Custom event broadcaster
     * <br />- inspired by Robert Penner's AS3 Signals.
     * @name Signal
     * @author Miller Medeiros
     * @constructor
     */
    function Signal() {
        /**
         * @type Array.<SignalBinding>
         * @private
         */
        this._bindings = [];
        this._prevParams = null;

        // enforce dispatch to aways work on same context (#47)
        var self = this;
        this.dispatch = function(){
            Signal.prototype.dispatch.apply(self, arguments);
        };
    }

    Signal.prototype = {

        /**
         * Signals Version Number
         * @type String
         * @const
         */
        VERSION : '1.0.0',

        /**
         * If Signal should keep record of previously dispatched parameters and
         * automatically execute listener during `add()`/`addOnce()` if Signal was
         * already dispatched before.
         * @type boolean
         */
        memorize : false,

        /**
         * @type boolean
         * @private
         */
        _shouldPropagate : true,

        /**
         * If Signal is active and should broadcast events.
         * <p><strong>IMPORTANT:</strong> Setting this property during a dispatch will only affect the next dispatch, if you want to stop the propagation of a signal use `halt()` instead.</p>
         * @type boolean
         */
        active : true,

        /**
         * @param {Function} listener
         * @param {boolean} isOnce
         * @param {Object} [listenerContext]
         * @param {Number} [priority]
         * @return {SignalBinding}
         * @private
         */
        _registerListener : function (listener, isOnce, listenerContext, priority) {

            var prevIndex = this._indexOfListener(listener, listenerContext),
                binding;

            if (prevIndex !== -1) {
                binding = this._bindings[prevIndex];
                if (binding.isOnce() !== isOnce) {
                    throw new Error('You cannot add'+ (isOnce? '' : 'Once') +'() then add'+ (!isOnce? '' : 'Once') +'() the same listener without removing the relationship first.');
                }
            } else {
                binding = new SignalBinding(this, listener, isOnce, listenerContext, priority);
                this._addBinding(binding);
            }

            if(this.memorize && this._prevParams){
                binding.execute(this._prevParams);
            }

            return binding;
        },

        /**
         * @param {SignalBinding} binding
         * @private
         */
        _addBinding : function (binding) {
            //simplified insertion sort
            var n = this._bindings.length;
            do { --n; } while (this._bindings[n] && binding._priority <= this._bindings[n]._priority);
            this._bindings.splice(n + 1, 0, binding);
        },

        /**
         * @param {Function} listener
         * @return {number}
         * @private
         */
        _indexOfListener : function (listener, context) {
            var n = this._bindings.length,
                cur;
            while (n--) {
                cur = this._bindings[n];
                if (cur._listener === listener && cur.context === context) {
                    return n;
                }
            }
            return -1;
        },

        /**
         * Check if listener was attached to Signal.
         * @param {Function} listener
         * @param {Object} [context]
         * @return {boolean} if Signal has the specified listener.
         */
        has : function (listener, context) {
            return this._indexOfListener(listener, context) !== -1;
        },

        /**
         * Add a listener to the signal.
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        add : function (listener, listenerContext, priority) {
            validateListener(listener, 'add');
            return this._registerListener(listener, false, listenerContext, priority);
        },

        /**
         * Add listener to the signal that should be removed after first execution (will be executed only once).
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        addOnce : function (listener, listenerContext, priority) {
            validateListener(listener, 'addOnce');
            return this._registerListener(listener, true, listenerContext, priority);
        },

        /**
         * Remove a single listener from the dispatch queue.
         * @param {Function} listener Handler function that should be removed.
         * @param {Object} [context] Execution context (since you can add the same handler multiple times if executing in a different context).
         * @return {Function} Listener handler function.
         */
        remove : function (listener, context) {
            validateListener(listener, 'remove');

            var i = this._indexOfListener(listener, context);
            if (i !== -1) {
                this._bindings[i]._destroy(); //no reason to a SignalBinding exist if it isn't attached to a signal
                this._bindings.splice(i, 1);
            }
            return listener;
        },

        /**
         * Remove all listeners from the Signal.
         */
        removeAll : function () {
            var n = this._bindings.length;
            while (n--) {
                this._bindings[n]._destroy();
            }
            this._bindings.length = 0;
        },

        /**
         * @return {number} Number of listeners attached to the Signal.
         */
        getNumListeners : function () {
            return this._bindings.length;
        },

        /**
         * Stop propagation of the event, blocking the dispatch to next listeners on the queue.
         * <p><strong>IMPORTANT:</strong> should be called only during signal dispatch, calling it before/after dispatch won't affect signal broadcast.</p>
         * @see Signal.prototype.disable
         */
        halt : function () {
            this._shouldPropagate = false;
        },

        /**
         * Dispatch/Broadcast Signal to all listeners added to the queue.
         * @param {...*} [params] Parameters that should be passed to each handler.
         */
        dispatch : function (params) {
            if (! this.active) {
                return;
            }

            var paramsArr = Array.prototype.slice.call(arguments),
                n = this._bindings.length,
                bindings;

            if (this.memorize) {
                this._prevParams = paramsArr;
            }

            if (! n) {
                //should come after memorize
                return;
            }

            bindings = this._bindings.slice(); //clone array in case add/remove items during dispatch
            this._shouldPropagate = true; //in case `halt` was called before dispatch or during the previous dispatch.

            //execute all callbacks until end of the list or until a callback returns `false` or stops propagation
            //reverse loop since listeners with higher priority will be added at the end of the list
            do { n--; } while (bindings[n] && this._shouldPropagate && bindings[n].execute(paramsArr) !== false);
        },

        /**
         * Forget memorized arguments.
         * @see Signal.memorize
         */
        forget : function(){
            this._prevParams = null;
        },

        /**
         * Remove all bindings from signal and destroy any reference to external objects (destroy Signal object).
         * <p><strong>IMPORTANT:</strong> calling any method on the signal instance after calling dispose will throw errors.</p>
         */
        dispose : function () {
            this.removeAll();
            delete this._bindings;
            delete this._prevParams;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[Signal active:'+ this.active +' numListeners:'+ this.getNumListeners() +']';
        }

    };


    // Namespace -----------------------------------------------------
    //================================================================

    /**
     * Signals namespace
     * @namespace
     * @name signals
     */
    var signals = Signal;

    /**
     * Custom event broadcaster
     * @see Signal
     */
    // alias for backwards compatibility (see #gh-44)
    signals.Signal = Signal;



    //exports to multiple environments
    if(typeof define === 'function' && define.amd){ //AMD
        define(function () { return signals; });
    } else if (typeof module !== 'undefined' && module.exports){ //node
        module.exports = signals;
    } else { //browser
        //use string because of Google closure compiler ADVANCED_MODE
        /*jslint sub:true */
        global['signals'] = signals;
    }

}(this));

},{}]},{},[9])});
