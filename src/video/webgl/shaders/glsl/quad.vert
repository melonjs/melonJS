precision highp float;


// Attributes

/**
 * Current vertex point
 * @ignore
 */
attribute vec2 aVertex;

/**
 * Vertex color
 * @ignore
 */
attribute vec4 aColor;

/**
 * Vertex texture unit index
 * Must be identical for all vertices in the quad
 * @ignore
 */
attribute float aTexture;

/**
 * Vertex texture coordinates
 * @ignore
 */
attribute vec2 aRegion;


// Uniforms

/**
 * Projection matrix
 * @ignore
 */
uniform mat3 uProjectionMatrix;


// Varyings

/**
 * Fragment color
 */
varying vec4 vColor;

/**
 * Fragment texture unit index
 * @ignore
 */
varying float vTexture;

/**
 * Fragment texture coordinates
 * @ignore
 */
varying vec2 vRegion;


void main(void) {
    // Transform the vertex position by the projection matrix
    gl_Position = vec4((uProjectionMatrix * vec3(aVertex, 1.0)).xy, 0.0, 1.0);

    // Pass the remaining attributes to the fragment shader
    vColor = vec4(aColor.rgb * aColor.a, aColor.a);
    vTexture = aTexture;
    vRegion = aRegion;
}
