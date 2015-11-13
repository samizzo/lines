/* global requirejs */

'use strict';

/*
inspiration: http://fernandojsg.com/project/ksynth/?fx=lines
do sinewaves too (separately): https://twitter.com/helvetica
*/

requirejs([
    'vec2',
    'texture',
    'shader'
], function (vec2, Texture, Shader) {
    var NUM_DOTS = 256;
    var RADIUS = 0.25;
    var STRENGTH = 0.25;
    var SPEED = 0.1;
    var MAX_LINES = NUM_DOTS * NUM_DOTS;

    var aspect = 1;

    var dots;
    var g_canvas, gl;
    var texture;
    var g_dotBuffer, g_dotTexCoordBuffer, g_dotIndicesBuffer;
    var dotShader, lineShader;
    var g_dotVerts, g_dotTexCoords, g_dotIndices;
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
        g_mouse.clientX = event.clientX;
        g_mouse.clientY = event.clientY;
    }

    function processMouse() {
        if (g_mouse.mouseDown) {
            var pos = { x: 0, y: 0 };
            pos.x = (g_mouse.clientX / (g_canvas.width - 1));
            pos.y = (g_mouse.clientY / (g_canvas.height - 1));
            pos.x = (pos.x * 2) - 1;
            pos.y = 1 - (pos.y * 2);

            for (var i = 0; i < NUM_DOTS; i++) {
                var d = dots[i];
                var dist = vec2.distance(d.position, pos);
                if (dist < RADIUS) {
                    var dir = vec2.sub(d.position, pos);
                    var scale = 1 - (dist / RADIUS);
                    d.velocity = vec2.add(d.velocity, vec2.mul(dir, STRENGTH * scale));
                }
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

        dotShader = new Shader(gl, '2d-vertex-shader', '2d-fragment-shader');
        dotShader.initAttribs([ 'a_position', 'a_texCoord' ]);
        dotShader.initUniforms([ 'u_translate', 'u_image' ]);

        lineShader = new Shader(gl, '2d-vertex-line-shader', '2d-fragment-line-shader');
        lineShader.initAttribs([ 'a_position', 'a_colour' ]);
        lineShader.initUniforms([ 'u_translate' ]);

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

        gl.bindBuffer(gl.ARRAY_BUFFER, g_dotBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, g_dotVerts, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, g_dotTexCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, g_dotTexCoords, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g_dotIndicesBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g_dotIndices, gl.STATIC_DRAW);

        lineVerts = new Float32Array(MAX_LINES * 2 * 2);
        lineCols = new Float32Array(MAX_LINES * 2 * 4);
        lineIndices = new Uint16Array(MAX_LINES * 2);

        var i;
        for (i = 0; i < lineIndices.length; i++) {
            lineIndices[i] = i;
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineIndicesBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lineIndices, gl.STATIC_DRAW);

        for (i = 0; i < lineCols.length; i++) {
            lineCols[i] = 1;
        }

        dots = [];
        for (i = 0; i < NUM_DOTS; i++) {
            var p = { x: (Math.random() * 2) - 1, y: (Math.random() * 2) - 1 };
            var v = { x: (Math.random() * 2) - 1, y: (Math.random() * 2) - 1 };
            v = vec2.mul(vec2.normalise(v), SPEED);
            p.x = Math.cos(i);
            p.y = Math.sin(i);

            dots[i] = {
                position: p,
                velocity: v
            };
        }
    }

    function update(delta) {
        processMouse();

        for (var i = 0; i < NUM_DOTS; i++) {
            var dot = dots[i];
            var p = dot.position;
            var v = dot.velocity;

            p = vec2.add(p, vec2.mul(v, delta));

            // Dampen velocity until it returns to the original speed.
            var speed = vec2.length(v);
            speed = Math.max(speed - (delta * 0.1), SPEED);
            v = vec2.normalise(v);
            v = vec2.mul(v, speed);

            if (p.y < -1 || p.y > 1) {
                // Off the top or bottom of the screen.
                v.y *= -1;
                p.y = p.y < -1 ? -1 : 1;
            } else if (p.x < -1 || p.x > 1) {
                // Off the left or right of the screen.
                v.x *= -1;
                p.x = p.x < -1 ? -1 : 1;
            }

            dot.position = p;
            dot.velocity = v;
        }
    }

    function render() {
        gl.clearColor(0, 0, 0, 1);
        gl.colorMask(true, true, true, true);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.disable(gl.CULL_FACE);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
        gl.enable(gl.BLEND);

        renderDots();
        renderLines();
    }

    function renderDots() {
        var attribs = dotShader.attribs;
        var uniforms = dotShader.uniforms;

        gl.useProgram(dotShader.program);
        gl.uniform1i(uniforms.u_image, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, g_dotBuffer);
        gl.enableVertexAttribArray(attribs.a_position);
        gl.vertexAttribPointer(attribs.a_position, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, g_dotTexCoordBuffer);
        gl.enableVertexAttribArray(attribs.a_texCoord);
        gl.vertexAttribPointer(attribs.a_texCoord, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g_dotIndicesBuffer);

        var i, p;

        for (i = 0; i < NUM_DOTS; i++) {
            p = dots[i].position;
            gl.uniform2fv(uniforms.u_translate, [ p.x, p.y ]);
            gl.drawElements(gl.TRIANGLE_STRIP, g_dotIndices.length, gl.UNSIGNED_SHORT, 0);
        }
    }

    function renderLines() {
        var i, p;
        var attribs = lineShader.attribs;
        var uniforms = lineShader.uniforms;

        gl.useProgram(lineShader.program);
        gl.uniform2fv(uniforms.u_translate, [ 0, 0 ]);

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
        gl.enableVertexAttribArray(attribs.a_position);
        gl.vertexAttribPointer(attribs.a_position, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, lineColsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, lineCols, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(attribs.a_colour);
        gl.vertexAttribPointer(attribs.a_colour, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineIndicesBuffer);
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
