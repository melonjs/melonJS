precision {{= ctx.precision }} float;


// Uniforms

/**
 * Fragment color
 * @ignore
 */
varying vec4 vColor;


void main(void) {
    gl_FragColor = vColor;
}
