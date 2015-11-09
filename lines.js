/* global requirejs */

'use strict';

/*
inspiration: http://fernandojsg.com/project/ksynth/?fx=lines
do sinewaves too (separately): https://twitter.com/helvetica
*/

requirejs([], function () {
    var NUM_DOTS = 64;

    var dots;
    var g_canvas, gl;
    var g_image;
    var g_dotBuffer, g_dotTexCoordBuffer, g_dotIndicesBuffer;
    var g_positionLocation, g_texCoordLocation;
    var g_texture;
    var g_program, g_lineProgram;
    var g_dotVerts, g_dotTexCoords, g_dotIndices;
    var g_translateUniform, g_imageUniform;

    var g_mouse = { mouseDown: false, mousePos: { x: 0, y: 0 } };

    function onImageLoaded() {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_image);
        render();
    }

    function onMouseDown(event) {
        g_mouse.mouseDown = event.button === 0;
    }

    function onMouseUp(event) {
        if (event.button === 0) {
            g_mouse.mouseDown = false;
        }
    }

    function distance(a, b) {
        var delta = { x: b.x - a.x, y: b.y - a.y };
        return Math.sqrt((delta.x*delta.x) + (delta.y*delta.y));
    }

    function length(a) {
        return Math.sqrt((a.x*a.x) + (a.y*a.y));
    }

    function add(a, b) {
        return { x: a.x + b.x, y: a.y + b.y };
    }

    function sub(a, b) {
        return { x: a.x - b.x, y: a.y - b.y };
    }

    function mul(a, scalar) {
        return { x: a.x * scalar, y: a.y * scalar };
    }

    function normalise(a) {
        var l = length(a);
        return mul(a, 1 / l);
    }

    function onMouseMove(event) {
        if (g_mouse.mouseDown) {
            var pos = { x: 0, y: 0 };
            pos.x = (event.clientX / (g_canvas.width - 1));
            pos.y = (event.clientY / (g_canvas.height - 1));
            pos.x = (pos.x * 2) - 1;
            pos.y = 1 - (pos.y * 2);

            var repaint = false;

            // TODO: Find nearby vertices and push them.

            if (repaint) {
                render();
            }
        }
    }

    function init(doHandlers) {
        g_canvas = document.getElementById('canvas');

        if (doHandlers) {
            g_canvas.addEventListener('mousedown', onMouseDown, false);
            g_canvas.addEventListener('mouseup', onMouseUp, false);
            g_canvas.addEventListener('mousemove', onMouseMove, false);
        }

        gl = g_canvas.getContext('webgl', { premultipliedAlpha: false }) || g_canvas.getContext('experimental-webgl', { premultipliedAlpha: false });

        // Load the shaders
        var vertexShader = window.createShaderFromScriptElement(gl, '2d-vertex-shader');
        var fragmentShader = window.createShaderFromScriptElement(gl, '2d-fragment-shader');
        g_program = window.createProgram(gl, [ vertexShader, fragmentShader ]);

        var lineFragmentShader = window.createShaderFromScriptElement(gl, '2d-fragment-line-shader');
        g_lineProgram = window.createProgram(gl, [ vertexShader, lineFragmentShader ]);

        g_positionLocation = gl.getAttribLocation(g_program, 'a_position');
        g_texCoordLocation = gl.getAttribLocation(g_program, 'a_texCoord');
        g_translateUniform = gl.getUniformLocation(g_program, 'u_translate');
        g_imageUniform = gl.getUniformLocation(g_program, 'u_image');

        g_dotBuffer = gl.createBuffer();
        g_dotTexCoordBuffer = gl.createBuffer();
        g_dotIndicesBuffer = gl.createBuffer();

        g_texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, g_texture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        g_image = new Image();
        g_image.onload = onImageLoaded;
        g_image.crossOrigin = '';
        g_image.src = 'dot.png';

        g_dotVerts = new Float32Array(4 * 2);
        g_dotTexCoords = new Float32Array(4 * 2);
        g_dotIndices = new Uint16Array(4);

        g_dotVerts[0] = -1 / 64; g_dotVerts[1] = 1 / 64;
        g_dotTexCoords[0] = 0; g_dotTexCoords[1] = 0;
        g_dotVerts[2] = 1 / 64; g_dotVerts[3] = 1 / 64;
        g_dotTexCoords[2] = 1; g_dotTexCoords[3] = 0;
        g_dotVerts[4] = 1 / 64; g_dotVerts[5] = -1 / 64;
        g_dotTexCoords[4] = 1; g_dotTexCoords[5] = 1;
        g_dotVerts[6] = -1 / 64; g_dotVerts[7] = -1 / 64;
        g_dotTexCoords[6] = 0; g_dotTexCoords[7] = 1;
        g_dotIndices[0] = 0;
        g_dotIndices[1] = 1;
        g_dotIndices[2] = 3;
        g_dotIndices[3] = 2;

        dots = [];
        for (var i = 0; i < NUM_DOTS; i++) {
            dots[i] = {
                position: { x: (Math.random() * 2) - 1, y: (Math.random() * 2) - 1 },
                velocity: { x: (Math.random() * 2) - 1, y: (Math.random() * 2) - 1 },
            };

            dots[i].velocity = mul(normalise(dots[i].velocity), 0.1);
        }
    }

    function update(delta) {
        for (var i = 0; i < NUM_DOTS; i++) {
            var dot = dots[i];
            var p = dot.position;
            var v = mul(dot.velocity, delta);
            p = add(p, v);

            if (p.y < -1 || p.y > 1) {
                // Off the top or bottom of the screen.
                dot.velocity.y *= -1;
                p.y = p.y < -1 ? -1 : 1;
            } else if (p.x < -1 || p.x > 1) {
                // Off the left or right of the screen.
                dot.velocity.x *= -1;
                p.x = p.x < -1 ? -1 : 1;
            }

            dots[i].position = p;
        }
    }

    function render() {
        gl.clearColor(0, 0, 0, 1);
        gl.colorMask(true, true, true, true);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.disable(gl.CULL_FACE);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
        gl.enable(gl.BLEND);

        // Render dots.
        gl.bindBuffer(gl.ARRAY_BUFFER, g_dotBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, g_dotVerts, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(g_positionLocation);
        gl.vertexAttribPointer(g_positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, g_dotTexCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, g_dotTexCoords, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(g_texCoordLocation);
        gl.vertexAttribPointer(g_texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        gl.useProgram(g_program);

        gl.uniform1i(g_imageUniform, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g_dotIndicesBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g_dotIndices, gl.STATIC_DRAW);

        for (var i = 0; i < NUM_DOTS; i++) {
            var p = dots[i].position;
            gl.uniform2fv(g_translateUniform, [ p.x, p.y ]);
            gl.drawElements(gl.TRIANGLE_STRIP, g_dotIndices.length, gl.UNSIGNED_SHORT, 0);
        }
    }

    (function() {
        var lastTime = 0;
        var vendors = ['webkit', 'moz'];
        for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
            window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
            window.cancelAnimationFrame =
              window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
        }

        if (!window.requestAnimationFrame)
            window.requestAnimationFrame = function(callback, element) {
                var currTime = new Date().getTime();
                var timeToCall = Math.max(0, 16 - (currTime - lastTime));
                var id = window.setTimeout(function() { callback(currTime + timeToCall); },
                  timeToCall);
                lastTime = currTime + timeToCall;
                return id;
            };

        if (!window.cancelAnimationFrame)
            window.cancelAnimationFrame = function(id) {
                clearTimeout(id);
            };
    }());

    init(true);

    var lastTime = 0;
    (function animloop(time) {
        var delta = (time - lastTime) / 1000;
        lastTime = time;
        window.requestAnimationFrame(animloop);
        update(delta);
        render();
    })(0);
});
