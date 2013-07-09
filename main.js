// Copyright 2013 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var fs = require('fs');
var http = require('http');
var manta = require('manta');
var path = require('path');
var qs = require('querystring');
var url = require('url');



///--- Globals

// These options are setup to allow pretty much any operation on an object
// Tweak as you see fit
var CORS_OPTIONS = {
    headers: {
            'access-control-allow-headers': 'access-control-allow-origin, accept, origin, content-type',
            'access-control-allow-methods': 'PUT,GET,HEAD,DELETE',
            'access-control-allow-origin': '*'
    }
};

// One global Manta client for all our code below
var CLIENT = manta.createClient({
    sign: manta.privateKeySigner({
        algorithm: 'RSA-SHA1',
        key: fs.readFileSync(process.env.HOME + '/.ssh/id_rsa', 'utf8'),
        keyId: process.env.MANTA_KEY_ID,
        user: process.env.MANTA_USER
    }),
    user: process.env.MANTA_USER,
    url: process.env.MANTA_URL
});

// The "root" location where user uploads are stored
var DROPBOX = '/' + process.env.MANTA_USER + '/stor/cors_demo';

// Our "webapp"
var HTML = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf8');

// The amount of grace time to allow a user to have a signed URL for
// uploading
var LIVE_TIME = 3600 * 1000; // 1 hour



///--- Helpers

// Simple helper method to log an incoming request to stdout
function logRequest(req) {
    console.log(req.method + ' ' + req.url);
    Object.keys(req.headers).forEach(function (k) {
        console.log(k + ': ' + req.headers[k]);
    });
    console.log();
}


// Parses the Cookie header for us (returned as a string)
function parseCookie(req) {
    var c = null;

    if (req.headers['cookie'])
        c = req.headers['cookie'].split('=').pop();

    return (c);
}



///--- Routes

// Manage a GET request of the "webapp". In real life you'd want
// to manage users with a real authentication session
function handleGet(req, res) {
    // Setup the world's worst session
    if (!(res.cookie = parseCookie(req)))
        res.cookie = Math.floor(Math.random() * 65535);

    // Now we create a per-session upload directory, so users can
    // upload without stomping each other. Only once we have their
    // dropbox setup do we return 200 and the HTML
    var dir = DROPBOX + '/' + res.cookie;
    CLIENT.mkdir(dir, CORS_OPTIONS, function (err) {
        if (err) {
            res._error(500, err);
        } else {
            res.setHeader('set-cookie', 'name=' + res.cookie);
            res.setHeader('content-type', 'text/html');
            res.setHeader('content-length', Buffer.byteLength(HTML));
            res.writeHead(200);
            res.end(HTML);
        }
    });
}


// Handles requests from the browser to ask for a signed URL upload location
// When the user sets a file in the upload form, the webpage makes an
// Ajax request back to us in order to get a signed URL that allows the browser
// to upload the file directly into Manta.  This is where we handle that. The
// user sent us a form, and all we do is spit back a place where they can upload
// the object with the same name
function handleSign(req, res) {
    if (!(res.cookie = parseCookie(req))) {
        res.error(400, 'no cookie sent');
        return;
    }

    var body = '';
    req.setEncoding('utf8');
    req.on('data', function (chunk) {
        body += chunk;
    });

    req.once('end', function () {
        var params = qs.parse(body) || {};
        if (!params.file) {
            res.error(409, 'Missing "file" parameter');
            return;
        }

        var opts = {
            expires: new Date().getTime() + LIVE_TIME,
            path: DROPBOX + '/' + res.cookie + '/' + params.file,
            method: ['OPTIONS', 'PUT'],
        };
        CLIENT.signURL(opts, function (err, signature) {
            if (err) {
                res.error(500, err);
                return;
            }

            var signed = JSON.stringify({
                url: process.env.MANTA_URL + signature
            });
            res.setHeader('content-type', 'application/json');
            res.setHeader('content-length', Buffer.byteLength(signed));
            res.writeHead(200);
            res.end(signed);
        });
    });
}


// This is the standard node HTTP "request" event handler
function onRequest(req, res) {
    // Uncomment this if you want to see the raw request logged
    // logRequest(req);

    // Setup a handy helper function for everybody to send errors
    // back
    res.error = function _error(code, err) {
        res.setHeader('content-type', 'text/plain');
        res.writeHead(code || 500);
        res.end(err ? (err.stack || err) : null);
    };

    // A poor man's request router
    if (req.method === 'POST') {
        if (req.url !== '/sign') {
            res.error(405, 'POST /sign');
        } else {
            handleSign(req, res);
        }
    } else if (req.method === 'GET' || req.method === 'HEAD') {
        if (req.url !== '/index.html') {
            if (req.url === '/favicon.ico') {
                res.error(404);
            } else {
                res.setHeader('location', '/index.html');
                res.error(302);
            }
        } else {
            handleGet(req, res);
        }
    } else {
        res.error(405);
    }
}



///--- Mainline

(function main() {
    // First, setup a staging area (or bail) that allows CORS writes
    CLIENT.mkdirp(DROPBOX, CORS_OPTIONS, function (err) {
        assert.ifError(err);

        // Once we know we have our "dropbox", we go ahead and start listening
        // for our user requests
        http.createServer(onRequest).listen(1234, function () {
            console.log('http://127.0.0.1:1234/index.html');
        });
    });
})();
