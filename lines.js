/* global requirejs */

'use strict';

/*
inspiration: http://fernandojsg.com/project/ksynth/?fx=lines
do sinewaves too (separately): https://twitter.com/helvetica
*/

requirejs([
    'vec2',
    'texture',
], function (vec2, Texture) {
    var NUM_DOTS = 128;
    var RADIUS = 0.25;
    var MAX_LINES = NUM_DOTS * NUM_DOTS;

    var aspect = 1;

    var dots;
    var g_canvas, gl;
    var texture;
    var g_dotBuffer, g_dotTexCoordBuffer, g_dotIndicesBuffer;
    var g_positionLocation, g_texCoordLocation;
    var g_program, g_lineProgram;
    var g_dotVerts, g_dotTexCoords, g_dotIndices;
    var g_translateUniform, g_imageUniform, lineTranslateUniform, linePositionLocation, lineColsLocation;
    var lineBuffer, lineIndicesBuffer;
    var lineVerts, lineIndices;
    var lineCols, lineColsBuffer;

    var g_mouse = { mouseDown: false, mousePos: { x: 0, y: 0 } };

    function onMouseDown(event) {
        g_mouse.mouseDown = event.button === 0;
    }

    function onMouseUp(event) {
        if (event.button === 0) {
            g_mouse.mouseDown = false;
        }
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
        aspect = g_canvas.height / g_canvas.width;

        // Load the shaders
        var vertexShader = window.createShaderFromScriptElement(gl, '2d-vertex-shader');
        var fragmentShader = window.createShaderFromScriptElement(gl, '2d-fragment-shader');
        g_program = window.createProgram(gl, [ vertexShader, fragmentShader ]);

        var lineVertexShader = window.createShaderFromScriptElement(gl, '2d-vertex-line-shader');
        var lineFragmentShader = window.createShaderFromScriptElement(gl, '2d-fragment-line-shader');
        g_lineProgram = window.createProgram(gl, [ lineVertexShader, lineFragmentShader ]);

        g_positionLocation = gl.getAttribLocation(g_program, 'a_position');
        g_texCoordLocation = gl.getAttribLocation(g_program, 'a_texCoord');
        g_translateUniform = gl.getUniformLocation(g_program, 'u_translate');
        g_imageUniform = gl.getUniformLocation(g_program, 'u_image');

        linePositionLocation = gl.getAttribLocation(g_lineProgram, 'a_position');
        lineColsLocation = gl.getAttribLocation(g_lineProgram, 'a_colour');
        lineTranslateUniform = gl.getUniformLocation(g_lineProgram, 'u_translate');

        g_dotBuffer = gl.createBuffer();
        g_dotTexCoordBuffer = gl.createBuffer();
        g_dotIndicesBuffer = gl.createBuffer();

        lineBuffer = gl.createBuffer();
        lineColsBuffer = gl.createBuffer();
        lineIndicesBuffer = gl.createBuffer();

        // Load the dot texture and leave it bound to texture slot 0.
        texture = new Texture(gl, 'dot.png');

        g_dotVerts = new Float32Array(4 * 2);
        g_dotTexCoords = new Float32Array(4 * 2);
        g_dotIndices = new Uint16Array(4);

        var dotsize = 64;
        g_dotVerts[0] = -aspect / dotsize; g_dotVerts[1] = 1 / dotsize;
        g_dotTexCoords[0] = 0; g_dotTexCoords[1] = 0;
        g_dotVerts[2] = aspect / dotsize; g_dotVerts[3] = 1 / dotsize;
        g_dotTexCoords[2] = 1; g_dotTexCoords[3] = 0;
        g_dotVerts[4] = aspect / dotsize; g_dotVerts[5] = -1 / dotsize;
        g_dotTexCoords[4] = 1; g_dotTexCoords[5] = 1;
        g_dotVerts[6] = -aspect / dotsize; g_dotVerts[7] = -1 / dotsize;
        g_dotTexCoords[6] = 0; g_dotTexCoords[7] = 1;
        g_dotIndices[0] = 0;
        g_dotIndices[1] = 1;
        g_dotIndices[2] = 3;
        g_dotIndices[3] = 2;

        lineVerts = new Float32Array(MAX_LINES * 2 * 2);
        lineCols = new Float32Array(MAX_LINES * 2 * 4);
        lineIndices = new Uint16Array(MAX_LINES * 2);

        var i;
        for (i = 0; i < lineIndices.length; i++) {
            lineIndices[i] = i;
        }

        for (i = 0; i < lineCols.length; i++) {
            lineCols[i] = 1;
        }

        dots = [];
        for (i = 0; i < NUM_DOTS; i++) {
            var p = { x: (Math.random() * 2) - 1, y: (Math.random() * 2) - 1 };
            var v = { x: (Math.random() * 2) - 1, y: (Math.random() * 2) - 1 };
            v = vec2.mul(vec2.normalise(v), 0.1);
            p.x = Math.cos(i);
            p.y = Math.sin(i);

            dots[i] = {
                position: p,
                velocity: v
            };
        }
    }

    function update(delta) {
        for (var i = 0; i < NUM_DOTS; i++) {
            var dot = dots[i];
            var p = dot.position;
            var v = vec2.mul(dot.velocity, delta);
            p = vec2.add(p, v);

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

        var i, p;

        for (i = 0; i < NUM_DOTS; i++) {
             p = dots[i].position;
            gl.uniform2fv(g_translateUniform, [ p.x, p.y ]);
            gl.drawElements(gl.TRIANGLE_STRIP, g_dotIndices.length, gl.UNSIGNED_SHORT, 0);
        }

        gl.useProgram(g_lineProgram);

        gl.uniform2fv(lineTranslateUniform, [ 0, 0 ]);

        var numLines = 0;
        for (i = 0; i < NUM_DOTS; i++) {
            p = dots[i].position;

            // Find any dots that this dot is near, and draw lines to them.
            for (var j = 0; j < NUM_DOTS; j++) {
                if (i === j) {
                    continue;
                }

                var pp = dots[j].position;
                var dist = vec2.distance(p, pp);
                if (dist < RADIUS && numLines < MAX_LINES) {
                    var alpha = 1 - (dist / RADIUS);
                    lineVerts[(numLines * 2 * 2) + 0] = p.x; lineVerts[(numLines * 2 * 2) + 1] = p.y;
                    lineCols[(numLines * 2 * 4) + 3] = alpha;
                    lineVerts[(numLines * 2 * 2) + 2] = pp.x; lineVerts[(numLines * 2 * 2) + 3] = pp.y;
                    lineCols[(numLines * 2 * 4) + 7] = alpha;
                    numLines++;
                }
            }
        }

        if (numLines === 0) {
            return;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, lineVerts, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(linePositionLocation);
        gl.vertexAttribPointer(linePositionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, lineColsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, lineCols, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(lineColsLocation);
        gl.vertexAttribPointer(lineColsLocation, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineIndicesBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lineIndices, gl.STATIC_DRAW);
        gl.drawElements(gl.LINES, numLines * 2, gl.UNSIGNED_SHORT, 0);
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
