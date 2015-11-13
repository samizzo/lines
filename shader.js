/* global define */

define(function() {
    'use strict';

    function Shader(gl, vertexShader, fragmentShader) {
        this.gl = gl;
        this.vertexShader = window.createShaderFromScriptElement(gl, vertexShader);
        this.fragmentShader = window.createShaderFromScriptElement(gl, fragmentShader);
        this.program = window.createProgram(gl, [ this.vertexShader, this.fragmentShader ]);
    }

    Shader.prototype.initAttribs = function (attribs) {
        this.attribs = {};
        for (var i = 0; i < attribs.length; i++) {
            var a = attribs[i];
            this.attribs[a] = this.gl.getAttribLocation(this.program, a);
        }
    };

    Shader.prototype.initUniforms = function (uniforms) {
        this.uniforms = {};
        for (var i = 0; i < uniforms.length; i++) {
            var u = uniforms[i];
            this.uniforms[u] = this.gl.getUniformLocation(this.program, u);
        }
    };

    return Shader;
});
