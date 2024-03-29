/**
#
#Copyright (c) 2010-2011 Razortooth Communications, LLC. All rights reserved.
#
#Redistribution and use in source and binary forms, with or without modification,
#are permitted provided that the following conditions are met:
#
#    * Redistributions of source code must retain the above copyright notice,
#      this list of conditions and the following disclaimer.
#
#    * Redistributions in binary form must reproduce the above copyright notice,
#      this list of conditions and the following disclaimer in the documentation
#      and/or other materials provided with the distribution.
#
#    * Neither the name of Razortooth Communications, LLC, nor the names of its
#      contributors may be used to endorse or promote products derived from this
#      software without specific prior written permission.
#
#THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
#ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
#WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
#DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
#ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
#(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
#LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
#ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
#(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
#SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
**/
var createServer = require("http").createServer;
var fs = require("fs");
var util = require("util");
var url = require("url");
var assert = require("assert");
var path = require("path");
var qs = require("querystring");

DEBUG = true;

if (DEBUG) {
	console.log("TURN OFF DEBUG for Production");
}

var fu = exports;

// XXX Localize these strings?
var NOT_FOUND = "Not Found\n";
var INTERNAL_SERVER_ERROR = 'Internal Server Error!  Oh pshaw\n';
var SERVER_RESTART_TIMEOUT = 15000; // 20 Seconds before notification
function notFound(req, res) {
	console.log("404 Error - " + req.url);
	fu.staticHandler("templates/404.html")(req,res); // XXX Ok, this is a little wierd to hardcode this in. 
	// Add these URLs to a set of standard URLs
}

function internalServerError2(req, res) {
	console.log("500 Error - " + req.url);
	fu.staticHandler("templates/500.html")(req,res); // XXX Ok, this is a little wierd to hardcode this in. 
	// Add these URLs to a set of standard URLs
}

function internalServerError(req, res) { // XXX Add a nicely formatted version!
  // XXX For some reason, this always returns garbage: 22 Internal Server Error.  Oh psh
  // Need to debug this!
  res.writeHead(500, {  'Content-Type': 'text/plain',
						'Content-Length': INTERNAL_SERVER_ERROR.length
                     });
  res.write(INTERNAL_SERVER_ERROR);
  // sys.log(sys.inspect(getMap, true, null)); // XXX Dump the getMap to the logs
  res.end();
}

var getMap = {};
var regexMap = {};

//
// DB Setup 
// XXX Should I move this up into server so I can register a callback, or should I abstract the db operations
//
fu.db = {};
fu.address = 'localhost';

//
// initDB() - pass in options to in the db and a handler to notify when done
//
// XXX TODO: implement the options and handler
fu.initDB = function(options, handler) {
	var channels_db = new dirty('channels.dirty');
	var sessions_db = new dirty('sessions.dirty');

	// XXX Refactor into a db setup fucntion
	// channels_db.on('load', handler);
	channels_db.on('load', function() {
		console.log("channel_db is loaded using dirty");
	});

	channels_db.on('drain', function() {
		console.log("channel_db records written out using dirty");
	});
	sessions_db.on('load', function() {
		console.log("session_db is loaded using dirty");
	});

	sessions_db.on('drain', function() {
		console.log("session_db records written out using dirty");
	});
	fu.db['channels'] = channels_db;
	fu.db['sessions'] = sessions_db;
	setTimeout(handler, SERVER_RESTART_TIMEOUT); // Give the existing channels time to be recreated
}

fu.get = function (path, handler) {
  getMap[path] = handler;
};

fu.getterer = function(path, handler) {
	var repath = RegExp(path);
	regexMap[path] = repath;
	// console.log(regexMap);
	fu.get(repath, handler);
}


var server = createServer(function (req, res) {
	try {
	  if (req.method === "GET" || req.method === "HEAD" || req.method === "POST") {
		var handler = false;
		// XXX Do a quick lookup.  If there is no match
		// Walk the regex object in a loop
		handler = getMap[url.parse(req.url).pathname];
		if (!handler) {
			for (var unid in regexMap) { 
				// console.log("testing path " + req.url + " vs. " + unid);
				// if (unid.test && unid.test(req.url)) handler = getMap[unid];
				// break;
				if (regexMap[unid].test(url.parse(req.url).pathname)) {
					console.log("Found matching regex for unid " + unid);
					handler = getMap[regexMap[unid].toString()];
					break;
				} else {
					// console.log("No match for regex");
					handler = notFound;
				}
			}
		}

	    res.simpleText = function (code, body) {
	      res.writeHead(code, { "Content-Type": "text/plain"
	                          , "Content-Length": body.length
	                          });
	      res.end(body);
	    };

	    res.simpleJSON = function (code, obj) {
	      var body = JSON.stringify(obj);
	      res.writeHead(code, { "Content-Type": "text/json"
	                          , "Content-Length": body.length
	                          });
	      res.end(body);
	    };

	    handler(req, res);
	  }
	} catch (e) {
		// handler = internalServerError;
		util.puts(new Error().stack);
		console.log("Caught a server-side Node.js exception.  Ouch!  Here's what happened: " + e.name + ". Error message: " + e.message);
		internalServerError2(req, res);
	}
});

fu.listen = function (port, host) {
	server.listen(port, host);
	if (server) {
		if (server.address()) {	
			fu.address = server.address().address;
		}
	}
	
	if (fu.address == '0.0.0.0') {
		getNetworkIP(function (error, ip) {
			if (!error) {
				fu.address = ip;
				console.log('Started server on IP address: ', fu.address);
			} else {
				console.log('error:', error);
			}
		}, false); 
	} else {
		console.log('Started server on IP address: ', fu.address);
	}
	util.puts("Server at http://" + (host || "127.0.0.1") + ":" + port.toString() + "/");
};

fu.close = function () { server.close(); };

function extname (path) {
  var index = path.lastIndexOf(".");
  return index < 0 ? "" : path.substring(index);
}

fu.renamelocalfile = function(from, to, handler) {
	fs.rename(from, to, handler); // XXX This needs and deserves tons and tons of security :(
}

fu.pullcontentdirs = function(crdbpath) {
	var dirlist = [];
	// Ignore dot directories
	var filter = /^\./i; // XXX DEMOSETTING put this somewhere else
	var contentdirs = [];
	try {
		dirlist = fs.readdirSync(crdbpath); // XXX make ASYNC
	} catch(err) {
		dirlist = [];
	}
	
	for (var i = 0; i < dirlist.length; i++) {
		if (fs.statSync(crdbpath + "/" + dirlist[i]).isDirectory()) { // XXX MAke ASYNC
			if (dirlist[i].toLowerCase().match(filter)) continue;
			contentdirs.push(dirlist[i]);
		}
	}
	return contentdirs;
}
fu.pullcontent = function(crdbpath, crdburl, chan) {
	// XXX This should get cached intelligently so you don't do file IO for each call unless cache is dirty

	var dirpath = "";
	var contentlist = [ ];
	var filter = /xml|db|^\./i; // XXX DEMOSETTING put this somewhere else
	if (chan) {
		dirpath = "/" + chan;
	}
	console.log(crdbpath + dirpath);
	var dircontents = [];
	
	try {
		dircontents = fs.readdirSync(crdbpath + dirpath); // XXX Can we make this more performant async, also, use a DB
	} catch(err) {
		dircontents = []
	}
	// XXX Need to check to see if path exists or else we will hit an exception
	for (var i = 0 ; i < dircontents.length; i++) {
		if (fs.statSync(crdbpath + dirpath + "/" + dircontents[i]).isDirectory()) continue; // XXX there is an opportunity to handle directories 
		if (dircontents[i].toLowerCase().indexOf('img') == 0) continue; // Skip HTML img template files
		if (dircontents[i].toLowerCase().match(filter)) continue; // Skip all items we want to filter.
		contentlist.push(crdburl + path.normalize(dirpath) + "/" + qs.escape(dircontents[i])); // XXX Double check this path on deploy?
	}
	return contentlist;
}

fu.staticHandler = function (filename) {
  var body, headers;
  var content_type = fu.mime.lookupExtension(extname(filename));

  function loadResponseData(callback) {
    if (body && headers && !DEBUG) {
      callback();
      return;
    }

    util.puts("loading " + filename + "...");
    fs.readFile(filename, function (err, data) {
      if (err) {
        util.puts("Error loading " + filename);
		console.log("Error loading file: " + filename + " because of " + err)
      } else {
        body = data;
        headers = { "Content-Type": content_type
                  , "Content-Length": body.length
                  };
        if (!DEBUG) headers["Cache-Control"] = "public";
        // sys.puts("static file " + filename + " loaded");
        callback();
      }
    });
  }

  return function (req, res) {
    loadResponseData(function () {
      res.writeHead(200, headers);
      res.end(req.method === "HEAD" ? "" : body);
    });
  }
};

fu.dkqs = {
	RE_OBJS : {"RE_ARRAYOBJ" : /\[(\/?)(\w+)([^>]*?)\]/ , },
	
	// The only reason I am doing this is because Node.js or me (not sure) has proven to be not so awesome
	// For some reason, on the plug, I get some garbage parsing of the payload and possibly some other data
	// So instead of relying on the garbage, parse it by hand :( barf ....
	// 'id=50335038871&text=http://192.168.1.16:5000/content/science/EarthChangingSurfaceHandout.pdf&type=mcprequest&channel=science&payload[apdu]=2&payload[to]=*&payload[requestoruri]=alexandr@50335038871&payload[ticketid]=<unique+ticket+ID>&payload[sync]=http://192.168.1.16:5000/content/science/EarthChangingSurfaceHandout.pdf'
	// This takes a QS and will convert it into a JSON object.  If a specific ID is passed in, it does something... TBD
	// Writing a good parser is tricky.  So for now, don't write a good one.  Just make one that gets the payload together.	
	getJSON: function(querystring, jsid) {
		var jsobj = {};
		
		if (querystring) {
			var splitqs;
			var payloadobj = {};
			querystring = qs.unescape(querystring); // First unescape
			splitqs = querystring.split('&');
			// sys.puts('fu.dkqs splitqs = ' + splitqs + ' length = ' + splitqs.length);
			for (var i = 0; i < splitqs.length; i++) {
				var item = splitqs[i];
				// sys.puts('fu.dkqs item = ' + item);
				var keyval = item.split('=');
				// sys.puts('fu.dkqs keyval = ' + keyval);
				var match = item.match(fu.dkqs.RE_OBJS["RE_ARRAYOBJ"]);
				if (match) { // If it contains an ARRAY of sorts, collect it into a single object
					// sys.puts(match);
					payloadobj[match[2]] = keyval[1];
				} else {
					jsobj[keyval[0]] = keyval[1];
				}
			}
			jsobj['payload'] = payloadobj; // XXX This is so dumb I am crying
		}
		
 		return jsobj;
	}, 
}
// stolen from jack- thanks
fu.mime = {
  // returns MIME type for extension, or fallback, or octet-steam
  lookupExtension : function(ext, fallback) {
    return fu.mime.TYPES[ext.toLowerCase()] || fallback || 'application/octet-stream';
  },

  // List of most common mime-types, stolen from Rack.
  TYPES : { ".3gp"   : "video/3gpp"
          , ".a"     : "application/octet-stream"
          , ".ai"    : "application/postscript"
          , ".aif"   : "audio/x-aiff"
          , ".aiff"  : "audio/x-aiff"
          , ".asc"   : "application/pgp-signature"
          , ".asf"   : "video/x-ms-asf"
          , ".asm"   : "text/x-asm"
          , ".asx"   : "video/x-ms-asf"
          , ".atom"  : "application/atom+xml"
          , ".au"    : "audio/basic"
          , ".avi"   : "video/x-msvideo"
          , ".bat"   : "application/x-msdownload"
          , ".bin"   : "application/octet-stream"
          , ".bmp"   : "image/bmp"
          , ".bz2"   : "application/x-bzip2"
          , ".c"     : "text/x-c"
          , ".cab"   : "application/vnd.ms-cab-compressed"
          , ".cc"    : "text/x-c"
          , ".chm"   : "application/vnd.ms-htmlhelp"
          , ".class"   : "application/octet-stream"
          , ".com"   : "application/x-msdownload"
          , ".conf"  : "text/plain"
          , ".cpp"   : "text/x-c"
          , ".crt"   : "application/x-x509-ca-cert"
          , ".css"   : "text/css"
          , ".csv"   : "text/csv"
          , ".cxx"   : "text/x-c"
          , ".deb"   : "application/x-debian-package"
          , ".der"   : "application/x-x509-ca-cert"
          , ".diff"  : "text/x-diff"
          , ".djv"   : "image/vnd.djvu"
          , ".djvu"  : "image/vnd.djvu"
          , ".dll"   : "application/x-msdownload"
          , ".dmg"   : "application/octet-stream"
          , ".doc"   : "application/msword"
          , ".dot"   : "application/msword"
          , ".dtd"   : "application/xml-dtd"
          , ".dvi"   : "application/x-dvi"
          , ".ear"   : "application/java-archive"
          , ".eml"   : "message/rfc822"
          , ".eps"   : "application/postscript"
          , ".exe"   : "application/x-msdownload"
          , ".f"     : "text/x-fortran"
          , ".f77"   : "text/x-fortran"
          , ".f90"   : "text/x-fortran"
          , ".flv"   : "video/x-flv"
		  , ".apk"	 : "application/vnd.android.package-archive"
          , ".for"   : "text/x-fortran"
          , ".gem"   : "application/octet-stream"
          , ".gemspec" : "text/x-script.ruby"
          , ".gif"   : "image/gif"
          , ".gz"    : "application/x-gzip"
          , ".h"     : "text/x-c"
          , ".hh"    : "text/x-c"
          , ".htm"   : "text/html"
          , ".html"  : "text/html"
          , ".ico"   : "image/vnd.microsoft.icon"
          , ".ics"   : "text/calendar"
          , ".ifb"   : "text/calendar"
          , ".iso"   : "application/octet-stream"
          , ".jar"   : "application/java-archive"
          , ".java"  : "text/x-java-source"
          , ".jnlp"  : "application/x-java-jnlp-file"
          , ".jpeg"  : "image/jpeg"
          , ".jpg"   : "image/jpeg"
          , ".js"    : "application/javascript"
          , ".json"  : "application/json"
          , ".log"   : "text/plain"
          , ".m3u"   : "audio/x-mpegurl"
          , ".m4v"   : "video/mp4"
          , ".man"   : "text/troff"
          , ".mathml"  : "application/mathml+xml"
          , ".mbox"  : "application/mbox"
          , ".mdoc"  : "text/troff"
          , ".me"    : "text/troff"
          , ".mid"   : "audio/midi"
          , ".midi"  : "audio/midi"
          , ".mime"  : "message/rfc822"
          , ".mml"   : "application/mathml+xml"
          , ".mng"   : "video/x-mng"
          , ".mov"   : "video/quicktime"
          , ".mp3"   : "audio/mpeg"
          , ".mp4"   : "video/mp4"
          , ".mp4v"  : "video/mp4"
          , ".mpeg"  : "video/mpeg"
          , ".mpg"   : "video/mpeg"
          , ".ms"    : "text/troff"
          , ".msi"   : "application/x-msdownload"
          , ".odp"   : "application/vnd.oasis.opendocument.presentation"
          , ".ods"   : "application/vnd.oasis.opendocument.spreadsheet"
          , ".odt"   : "application/vnd.oasis.opendocument.text"
          , ".ogg"   : "application/ogg"
          , ".p"     : "text/x-pascal"
          , ".pas"   : "text/x-pascal"
          , ".pbm"   : "image/x-portable-bitmap"
          , ".pdf"   : "application/pdf"
          , ".pem"   : "application/x-x509-ca-cert"
          , ".pgm"   : "image/x-portable-graymap"
          , ".pgp"   : "application/pgp-encrypted"
          , ".pkg"   : "application/octet-stream"
          , ".pl"    : "text/x-script.perl"
          , ".pm"    : "text/x-script.perl-module"
          , ".png"   : "image/png"
          , ".pnm"   : "image/x-portable-anymap"
          , ".ppm"   : "image/x-portable-pixmap"
          , ".pps"   : "application/vnd.ms-powerpoint"
          , ".ppt"   : "application/vnd.ms-powerpoint"
          , ".ps"    : "application/postscript"
          , ".psd"   : "image/vnd.adobe.photoshop"
          , ".py"    : "text/x-script.python"
          , ".qt"    : "video/quicktime"
          , ".ra"    : "audio/x-pn-realaudio"
          , ".rake"  : "text/x-script.ruby"
          , ".ram"   : "audio/x-pn-realaudio"
          , ".rar"   : "application/x-rar-compressed"
          , ".rb"    : "text/x-script.ruby"
          , ".rdf"   : "application/rdf+xml"
          , ".roff"  : "text/troff"
          , ".rpm"   : "application/x-redhat-package-manager"
          , ".rss"   : "application/rss+xml"
          , ".rtf"   : "application/rtf"
          , ".ru"    : "text/x-script.ruby"
          , ".s"     : "text/x-asm"
          , ".sgm"   : "text/sgml"
          , ".sgml"  : "text/sgml"
          , ".sh"    : "application/x-sh"
          , ".sig"   : "application/pgp-signature"
          , ".snd"   : "audio/basic"
          , ".so"    : "application/octet-stream"
          , ".svg"   : "image/svg+xml"
          , ".svgz"  : "image/svg+xml"
          , ".swf"   : "application/x-shockwave-flash"
          , ".t"     : "text/troff"
          , ".tar"   : "application/x-tar"
          , ".tbz"   : "application/x-bzip-compressed-tar"
          , ".tcl"   : "application/x-tcl"
          , ".tex"   : "application/x-tex"
          , ".texi"  : "application/x-texinfo"
          , ".texinfo" : "application/x-texinfo"
          , ".text"  : "text/plain"
          , ".tif"   : "image/tiff"
          , ".tiff"  : "image/tiff"
          , ".torrent" : "application/x-bittorrent"
          , ".tr"    : "text/troff"
          , ".txt"   : "text/plain"
          , ".vcf"   : "text/x-vcard"
          , ".vcs"   : "text/x-vcalendar"
          , ".vrml"  : "model/vrml"
          , ".war"   : "application/java-archive"
          , ".wav"   : "audio/x-wav"
          , ".wma"   : "audio/x-ms-wma"
          , ".wmv"   : "video/x-ms-wmv"
          , ".wmx"   : "video/x-ms-wmx"
          , ".wrl"   : "model/vrml"
          , ".wsdl"  : "application/wsdl+xml"
          , ".xbm"   : "image/x-xbitmap"
          , ".xhtml"   : "application/xhtml+xml"
          , ".xls"   : "application/vnd.ms-excel"
          , ".xml"   : "application/xml"
          , ".xpm"   : "image/x-xpixmap"
          , ".xsl"   : "application/xml"
          , ".xslt"  : "application/xslt+xml"
          , ".yaml"  : "text/yaml"
          , ".yml"   : "text/yaml"
          , ".zip"   : "application/zip"
          }
};

/** 
	getNetworkIP()
	
	XXX Refactor out into a utility class
	
	Similar problem and similar answer found on python, drop down to os process and figure it out
	by sniffing off ifconfig.  May be tricky if you are looking for wireless interface, so probably
	would need to grab my code from python to remember what I did there that was clever.
	
	Code Borrowed from contribution by pumbaa80
	Thanks Stackoverflow: http://stackoverflow.com/posts/3742915/revisions
**/
var getNetworkIP = (function () {
    var ignoreRE = /^(127\.0\.0\.1|::1|fe80(:1)?::1(%.*)?)$/i;

    var exec = require('child_process').exec;
    var cached;    
    var command;
    var filterRE;

    switch (process.platform) {
    // TODO: implement for OSs without ifconfig command
    case 'darwin':
         command = 'ifconfig';
         filterRE = /\binet\s+([^\s]+)/g;
         // filterRE = /\binet6\s+([^\s]+)/g; // IPv6
         break;
    default:
         command = 'ifconfig';
         filterRE = /\binet\b[^:]+:\s*([^\s]+)/g;
         // filterRE = /\binet6[^:]+:\s*([^\s]+)/g; // IPv6
         break;
    }

    return function (callback, bypassCache) {
         // get cached value
        if (cached && !bypassCache) {
            callback(null, cached);
            return;
        }
        // system call
        exec(command, function (error, stdout, sterr) {
            var ips = [];
            // extract IPs
            var matches = stdout.match(filterRE);
            // JS has no lookbehind REs, so we need a trick
            for (var i = 0; i < matches.length; i++) {
                ips.push(matches[i].replace(filterRE, '$1'));
            }

            // filter BS
            for (var i = 0, l = ips.length; i < l; i++) {
                if (!ignoreRE.test(ips[i])) {
                    //if (!error) {
                        cached = ips[i];
                    //}
                    callback(error, ips[i]);
                    return;
                }
            }
            // nothing found
            callback(error, null);
        });
    };
})();

