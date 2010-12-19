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
var sys = require("sys");
var url = require("url");
var assert = require("assert");
var path = require("path");
var qs = require("querystring");
var	dirty = require("./dirty");

DEBUG = true;

if (DEBUG) {
	console.log("TURN OFF DEBUG for Production");
}

var fu = exports;

// XXX Localize these strings?
var NOT_FOUND = "Not Found\n";
var INTERNAL_SERVER_ERROR = 'Internal Server Error!  Oh pshaw\n';

function notFound(req, res) {
	console.log("404 Error - ");
	fu.staticHandler("templates/learn-simplified-german.html")(req,res); // XXX Ok, this is a little wierd to hardcode this in. 
	// Add these URLs to a set of standard URLs
}

function internalServerError2(req, res) {
	console.log("500 Error - ");
	fu.staticHandler("templates/oh-pshaw.html")(req,res); // XXX Ok, this is a little wierd to hardcode this in. 
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
var channels_db = new dirty('channels.dirty');
var sessions_db = new dirty('sessions.dirty');

// XXX Refactor into a db setup fucntion
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
	  if (req.method === "GET" || req.method === "HEAD") {
	    // var handler = getMap[url.parse(req.url).pathname] || notFound; // XXX Test for regex
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
		// sys.puts(new Error().stack);
		console.log("Caught a server-side Node.js exception.  Ouch!  Here's what happened: " + e.name + ". Error message: " + e.message);
		internalServerError2(req, res);
		sys.puts("done done");
	}
});

fu.listen = function (port, host) {
  server.listen(port, host);
  sys.puts("Server at http://" + (host || "127.0.0.1") + ":" + port.toString() + "/");
};

fu.close = function () { server.close(); };

function extname (path) {
  var index = path.lastIndexOf(".");
  return index < 0 ? "" : path.substring(index);
}

fu.pullcontent = function(crdbpath, crdburl, chan) {
	// XXX This should get cached intelligently so you don't do file IO for each call unless cache is dirty

	var dirpath = "";
	var contentlist = [ ];
	var filter = /pdf|^\./i;
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

    sys.puts("loading " + filename + "...");
    fs.readFile(filename, function (err, data) {
      if (err) {
        sys.puts("Error loading " + filename);
		console.log("Error loading file: " + filename + " because of " + err)
      } else {
        body = data;
        headers = { "Content-Type": content_type
                  , "Content-Length": body.length
                  };
        if (!DEBUG) headers["Cache-Control"] = "public";
        sys.puts("static file " + filename + " loaded");
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
