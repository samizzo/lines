/* global define */

define(function() {
    'use strict';

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

    var exports = {
        distance: distance,
        length: length,
        add: add,
        sub: sub,
        mul: mul,
        normalise: normalise,
        zero: { x: 0, y: 0 }
    };
    return exports;
});
