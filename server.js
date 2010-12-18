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
/* 

Original node_chat.git LICENSE:

Copyright 2009,2010 Ryan Dahl <ry@tinyclouds.org>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
*/

// XXX MOVE this config to a config file
//
// HOST - the hostname
//
HOST = null; // localhost

//
// PORT - the listening port
//
PORT = 5000;


//
// CONTENT_REPO_URL - the base URL for hosting all content
//
CONTENT_REPO_URL = "http://localhost:5000/content"; // XXX Just figure out the IP address

//
// CONTENT_REPO_FILE_PATH - the base path to look into for a directory mapping to classroom
//
// CONTENT_REPO_FILE_PATH = "/var/www/mediafiles";
// CONTENT_REPO_FILE_PATH = "./contentrepo"; // XXX This is lame... but best effort for now, we
CONTENT_REPO_FILE_PATH = "/home/dkords/Pictures"; // XXX This is lame... but best effort for now, 
// We need to crawl the list of files available on the web server
// where the content is located.  This is best to have come from a 
// CMS, but we need something that will give us a nice file list
// but also serve up content appropriately for each format with correct
// mime types returned.  
// Time to add a database?

//
// CONTENT_REPO_LOCAL_URL
// 
// Since android sucks... this will only
// work on android.  Ideally we should
// not sniffing browser user agents or 
// versions.
CONTENT_REPO_LOCAL_URL = "content://com.android.htmlfileprovider/sdcard/content"; // XXX This is fixed for android!!!!

// when the daemon started
var starttime = (new Date()).getTime();
//
// VERSION - generic version string for support and QA
//
VERSION = "ces-marvell-v2-" + starttime ;  // XXX Can  we instrument this using hudson during packaging, maybe use commit GUID

var mem = process.memoryUsage();

var channels = {};

// 
// System Status 
//
// every 10 seconds poll for the memory.
setInterval(function () {
  mem = process.memoryUsage();
}, 10*1000);


var fu = require("./static/js/fu"),
    sys = require("sys"),
    url = require("url"),
    qs = require("querystring"),
    nTPL = require("nTPL").plugins("nTPL.block", "nTPL.filter").nTPL;
	

var MESSAGE_BACKLOG = 200,
    SESSION_TIMEOUT = 60 * 1000; // XXX 1000ms = 1 s * 60 = 1 minutethis should be configurable

function channelFactory() {
	var channel = new function () {
		var messages = [],
			callbacks = [];
		this.sessions = {};
		this.appendMessage = function (nick, type, text) {
		var m = { nick: nick
		   , type: type // See switch statement below
		   , text: text
		   , timestamp: (new Date()).getTime()
		};

		switch (type) {
			case "msg":
				sys.puts("<" + nick + "> " + text);
				break;
			case "join":
				sys.puts(nick + " join");
				break;
			case "part":
				sys.puts(nick + " part");
				break;
			case "startsession":
				sys.puts(nick + " startsession");
				break;
			case "endsession":
				sys.puts(nick + " endsession");
				break;
			case "sendviewer":
				sys.puts(nick + " sendviewer");
				break;
			case "askquestion":
				sys.puts(nick + " askquestion");
				break;
			case "sendviewerlocal":
				var local_url = text.replace(CONTENT_REPO_URL, CONTENT_REPO_LOCAL_URL);
			 	sys.puts(nick + " sendviewerlocal, transforming player URL from " + text + 
				" to " + local_url);
				m.text = local_url;
				break;
			case "endviewer":
				sys.puts(nick + " endviewer");
				break;
		}

	    messages.push( m );

	    while (callbacks.length > 0) {
	      callbacks.shift().callback([m]);
	    }

	    while (messages.length > MESSAGE_BACKLOG)
	      messages.shift();
  };

  this.query = function (since, callback) {
    var matching = [];
    for (var i = 0; i < messages.length; i++) {
      var message = messages[i];
      if (message.timestamp > since)
        matching.push(message)
    }

    if (matching.length != 0) {
      callback(matching);
    } else {
      callbacks.push({ timestamp: new Date(), callback: callback });
    }
  };

  // clear old callbacks
  // they can hang around for at most 30 seconds.
  setInterval(function () {
    var now = new Date();
    while (callbacks.length > 0 && now - callbacks[0].timestamp > 30*1000) {
      callbacks.shift().callback([]);
    }
  }, 3000);
};
	return channel;
} // channelFactory
	
function createSession (nick, chan) {
  if (nick.length > 50) return null;
  if (/[^\w_\-^!]/.exec(nick)) return null;
  
  var channel = channels[chan];
  var sessions;
  
  if (channel == null) sessions = {}; else sessions = channel.sessions;
	  
  for (var i in sessions) {
    var session = sessions[i];
    if (session && session.nick === nick) return null; // XXX Why do we not simply rejoin?  We should at least respond with an affirmative
  }

  var session = { 
    nick: nick, 
    id: Math.floor(Math.random()*99999999999).toString(),
    timestamp: new Date(),

    poke: function () {
      session.timestamp = new Date();
    },

    destroy: function () {
      channel.appendMessage(session.nick, "part");
      delete sessions[session.id];
    }
  };

  sessions[session.id] = session;
  return session;
}

// interval to kill off old sessions
setInterval(function () {
  var now = new Date();
  for (var chan in channels) {
	var sessions = channels[chan].sessions; // XXX I may need to guard against null or undefined
	for (var id in sessions) {
		if (!sessions.hasOwnProperty(id)) continue;
		var session = sessions[id];

		if (now - session.timestamp > SESSION_TIMEOUT) {
			session.destroy();
		}
	}
  }
}, 1000);


fu.listen(Number(process.env.PORT || PORT), HOST);

//
// ===============================================
// Route Setup
// ===============================================
//

// 
// TEST ROUTES, REMOVE LATER
//
fu.get("/hello-test-nTPL", function( req, res ) {
  res.writeHead(200, {"Content-Type": "text/html"});   
  var test_tpl = nTPL("./templates/ntpl-index.html");
  var base = nTPL("./templates/ntpl-base.html");
  res.end(test_tpl({
      username: "Paul",
      userfax: "12345678",
      usermail: "a@a.com"
    }));
  // res.end();
});

fu.get("/hello-test2-nTPL", function( req, res ) {
  res.writeHead(200, {"Content-Type": "text/html"});   
  var test2_tpl = nTPL("./templates/ntpl-test2.html");
  var base = nTPL("./templates/boilerplate-ntpl.html");
  res.end(test2_tpl({
      username: "Paul",
      userfax: "12345678",
      usermail: "a@a.com"
    }));
  // res.end();
});

fu.get("/helloworld", function(req, res) {
	var body = 'hello world';
	res.writeHead(200, {
	  'Content-Length': body.length,
	  'Content-Type': 'text/plain'
	});
	res.write(body);
	res.end();
});

fu.get("/about", function(req, res) {
	var body = 'EpochEDU version: ' + VERSION;
	res.writeHead(200, {
	  'Content-Length': body.length,
	  'Content-Type': 'text/plain'
	});
	res.write(body);
	res.end();
});
//
// STATIC ROUTES
//
fu.get("/student", fu.staticHandler("templates/epoch-student-landing.html"));
fu.get("/teacher", fu.staticHandler("templates/epoch-teacher-landing.html"));
fu.get("/cruzy", fu.staticHandler("templates/chat.html"));
fu.getterer("/static/[\\w\\.\\-]+", function(req, res) {
	return fu.staticHandler("." + url.parse(req.url).pathname)(req, res);
});
fu.getterer("/templates/[\\w\\.\\-]+", function(req, res) {
	return fu.staticHandler("." + url.parse(req.url).pathname)(req, res);
});
fu.getterer("/content/[\\w\\.\\-]+", function(req, res) {
	return fu.staticHandler(CONTENT_REPO_FILE_PATH + req.url.substring(req.url.indexOf('/content') + '/content'.length)) (req, res);
});

//
// APP ROUTES
//

fu.getterer("/cruzy", function(req, res) {
	var chan = "default";
	res.writeHead(200, {"Content-Type": "text/html"});   
	  var index_tpl = nTPL("./templates/index.html"); // XXX later, force this over to generic chat page
	  var base = nTPL("./templates/boilerplate-jqm-ntpl.html");
	  res.end(index_tpl({
	      channel: chan,
	    }));
});
// fu.get("/class/[\\w\\.\\-]+", fu.staticHandler("templates/epoch-teacher-landing.html"));

fu.getterer("/class/[\\w\\.\\-]+", function(req, res) {
	var chan = url.parse(req.url).pathname.split("/")[2];
	res.writeHead(200, {"Content-Type": "text/html"});   
	  var student_tpl = nTPL("./templates/student-jqm-ntpl.html");
	  var base = nTPL("./templates/boilerplate-jqm-ntpl.html"); // JQM
	  res.end(student_tpl({
	      channel: chan,
	    }));
});

fu.getterer("/class-v1/[\\w\\.\\-]+", function(req, res) {
	var chan = url.parse(req.url).pathname.split("/")[2];
	res.writeHead(200, {"Content-Type": "text/html"});   
	  var student_tpl = nTPL("./templates/epoch-student-v2.html");
	  var base = nTPL("./templates/boilerplate-ntpl.html"); // V1
	  res.end(student_tpl({
	      channel: chan,
	    }));
});

fu.getterer("/classmoderator/[\\w\\.\\-]+", function(req, res) {
	var chan = url.parse(req.url).pathname.split("/")[2];
	var contentlist = fu.pullcontent(CONTENT_REPO_FILE_PATH, CONTENT_REPO_URL, chan);
	var roomcl = JSON.stringify(contentlist);
		
	res.writeHead(200, {"Content-Type": "text/html"});   
	  var teacher_tpl = nTPL("./templates/teacher-jqm-ntpl.html");
	  var base = nTPL("./templates/boilerplate-jqm-ntpl.html"); // JQM
	  res.end(teacher_tpl({
	      channel: chan,
		  roomcl: roomcl,
	    }));
});

fu.getterer("/classmoderator-v1/[\\w\\.\\-]+", function(req, res) {
	var chan = url.parse(req.url).pathname.split("/")[2];
	var contentlist = fu.pullcontent(CONTENT_REPO_FILE_PATH, CONTENT_REPO_URL, chan);
	var roomcl = JSON.stringify(contentlist); // V1
		
	res.writeHead(200, {"Content-Type": "text/html"});   
	  var teacher_tpl = nTPL("./templates/epoch-teacher-v2.html");
	  var base = nTPL("./templates/boilerplate-ntpl.html");
	  res.end(teacher_tpl({
	      channel: chan,
		  roomcl: roomcl,
	    }));
});

fu.getterer("/crdb/[\\w\\.\\-]+", function(req, res) {
	var requrlobj = url.parse(req.url);
	var chan = requrlobj.pathname.split("/")[2];
	var host = requrlobj.host;
	var output = qs.parse(requrlobj.query).output;
	var contentlist;
	
	// Load all of the content from disk
	contentlist = fu.pullcontent(CONTENT_REPO_FILE_PATH, CONTENT_REPO_URL, chan);
	if (output != null && output == "json") {
		res.simpleJSON(200, contentlist)
	} else {
		var body = JSON.stringify(contentlist)
		
		res.writeHead(200, {
		  'Content-Length': body.length,
		  'Content-Type': 'text/plain'
		});
		res.write(body);
		res.end();
	}
});

fu.get("/who", function (req, res) {
  var nicks = [];
  var chan = qs.parse(url.parse(req.url).query).channel;
  var sessions = channels[chan].sessions;
  	
  for (var id in sessions) {
    if (!sessions.hasOwnProperty(id)) continue;
    var session = sessions[id];
    nicks.push(session.nick);
  }
  res.simpleJSON(200, { nicks: nicks
                      , rss: mem.rss
                      });
});

fu.get("/join", function (req, res) {
  var nick = qs.parse(url.parse(req.url).query).nick;
  var chan = qs.parse(url.parse(req.url).query).channel;
	
  if (nick == null || nick.length == 0) {
	sys.puts('Error 400: bad nock');
    res.simpleJSON(400, {error: "Bad nick."});
    return;
  }
  var session = createSession(nick, chan);
  // XXX Cleanup this error handling!!!!!
  if (channels[chan] == null) {
	  res.simpleJSON(400, {error: "Unable to create channel for " + chan}); // can I just return this resp?
	  return;
  } else if (session == null) { // XXX Need to clean up the handling of "nick in use"
    sys.puts('Error: nick in use');
    res.simpleJSON(400, {error: "Nick in use", code: 1});
    return;
  } else {
	  channels[chan].sessions[session.id] = session;
  }

  sys.puts("connection: " + nick + "@" + res.connection.remoteAddress + " on " + chan);

  channels[chan].appendMessage(session.nick, "join");
  res.simpleJSON(200, { id: session.id
                      , nick: session.nick
                      , rss: mem.rss
                      , starttime: starttime
                      });
});

fu.get("/part", function (req, res) {
  var id = qs.parse(url.parse(req.url).query).id;
  var chan = qs.parse(url.parse(req.url).query).channel;
  var sessions = channels[chan].sessions;
  var session;
  if (id && sessions[id]) {
    session = sessions[id];
    session.destroy();
  }
  res.simpleJSON(200, { rss: mem.rss });
});

fu.get("/recv", function (req, res) {
  var chan = qs.parse(url.parse(req.url).query).channel;
  // XXX Clean up this mess
  if (chan == null) {
	 sys.puts('channel is null');
	 return res.simpleJSON(400, {error: "Must provide a channel"}); // XXX Need to just provide a default channel
  }
  var achannel = channels[chan];
  var sessions;
  
  // sys.puts("channel is " + chan);
  if (achannel == null) {
	  // sys.puts("Creating new channel for " + chan);
	  achannel = channelFactory();
	  
	  if (achannel == null) sys.puts('/recv achannel is null');
	  channels[chan] = achannel;
	  
  }
  // sys.puts('/recv channels = ' + channels);
  achannel = channels[chan];
  // sys.puts('/recv achannel = ' + achannel);
  sessions = achannel.sessions;
  // sys.puts('/recv sessions is = ' + sessions);
  // sys.puts('/recv parsing query');
  if (!qs.parse(url.parse(req.url).query).since) {
	sys.puts('ERROR: 400 must supply since parameter');
    res.simpleJSON(400, { error: "Must supply since parameter" });
    return;
  }
  var id = qs.parse(url.parse(req.url).query).id;
  // sys.puts('/recv parsing id = ' + id);
  
  var session;
  
  if (id != null && sessions[id]) {
    // sys.puts('/recv setting session for id = ' + id);
    session = sessions[id];
    session.poke();
  }
  // sys.puts('/recv setting since');
  
  var since = parseInt(qs.parse(url.parse(req.url).query).since, 10);

  achannel.query(since, function (messages) { 
    // sys.puts("channel session query");
    if (session) session.poke();
    res.simpleJSON(200, { messages: messages, rss: mem.rss });
  });
  // sys.puts("Done with /recv");
});

fu.get("/send", function (req, res) {
  var id = qs.parse(url.parse(req.url).query).id;
  var text = qs.parse(url.parse(req.url).query).text;
  var type = qs.parse(url.parse(req.url).query).type;
  var chan = qs.parse(url.parse(req.url).query).channel;
  var channel = channels[chan];
  var sessions = channel.sessions;
  if (!chan) { // XXX refactor to use default channel
	  sys.puts('Error 400: channel required');
	  res.simpleJSON(400, { error: "Channel required"});
	  return;
  } else if (!sessions) {
	  sys.puts('Error 400: unable to get sessions');
	  res.simpleJSON(400, { error: "Unable to get the session for channel " + chan});
	  return;
  }
  if (!type) type = "msg"; // XXX Are there any side effects to this?
  sys.puts("send received message type = " + type);
  var session = sessions[id];
  if (!session) {
	sys.puts('Error 400: no such session for id');
	//
	// Try to reconnect
	// 
	// XXX TODO, implement ...
	// If the server went down, rebooted, or reset, we should be able
	// lookup the session in a DB and reconnect
	//
    res.simpleJSON(400, { error: "No such session for id" });
    return;
  }
  
  if (!text) {
	sys.puts('Error 400: empty message not allowed');
    res.simpleJSON(400, { error: "empty message not allowed" });
    return;
  }

  session.poke();
  // sys.puts("/send testing for text value");
  if (text && text.match(/#startsession/i)) {
	channel.appendMessage(session.nick, "startsession", text);
  } else if (text && text.match(/#endsession/i)) {
	channel.appendMessage(session.nick, "endsession", text);
  } else {
  	channel.appendMessage(session.nick, type, text);
  }
  res.simpleJSON(200, { rss: mem.rss });
});


