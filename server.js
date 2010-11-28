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
HOST = null; // localhost
PORT = 5000;
CONTENT_REPO_URL = "http://192.168.1.148:80/~dkords"; // XXX Configure this!!!! We need a GUI to manage this
VERSION = "elearn-marvell-rc7-10202010";

// CONTENT_REPO_URL = "http://192.168.1.16:80/mediafiles";
// CONTENT_REPO_FILE_PATH = "/var/www/mediafiles";
CONTENT_REPO_FILE_PATH = "./contentrepo"; // XXX This is lame... but best effort for now, we
										  // We need to crawl the list of files available on the web server
										  // where the content is located.  This is best to have come from a 
										  // CMS, but we need something that will give us a nice file list
										  // but also serve up content appropriately for each format with correct
										  // mime types returned.  
CONTENT_REPO_LOCAL_URL = "content://com.android.htmlfileprovider/sdcard/content"; // XXX This is fixed for android!!!!
																		  // Since android sucks... this will only
																		  // work on android.  Ideally we should
																		  // be detecting browser capabilities
																		  // not sniffing browser user agents or 
																		  // versions.

// when the daemon started
var starttime = (new Date()).getTime();

var mem = process.memoryUsage();
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
    SESSION_TIMEOUT = 60 * 1000;

var channel = new function () {
	var messages = [],
		callbacks = [];

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

var sessions = {};

function createSession (nick) {
  if (nick.length > 50) return null;
  if (/[^\w_\-^!]/.exec(nick)) return null;

  for (var i in sessions) {
    var session = sessions[i];
    if (session && session.nick === nick) return null;
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
  for (var id in sessions) {
    if (!sessions.hasOwnProperty(id)) continue;
    var session = sessions[id];

    if (now - session.timestamp > SESSION_TIMEOUT) {
      session.destroy();
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
// fu.get("/student", fu.staticHandler("templates/epoch-student-landing.html"));
fu.get("/teacher", fu.staticHandler("templates/epoch-teacher-landing.html"));
fu.getterer("/static/[\\w\\.\\-]+", function(req, res) {
	return fu.staticHandler("." + url.parse(req.url).pathname)(req, res);
});
fu.getterer("/templates/[\\w\\.\\-]+", function(req, res) {
	return fu.staticHandler("." + url.parse(req.url).pathname)(req, res);
});

//
// APP ROUTES
//

fu.get("/", fu.staticHandler("templates/index.html")); // Default node_chat app XXX change this

fu.getterer("/class/[\\w\\.\\-]+", function(req, res) {
	var chan = url.parse(req.url).pathname.split("/")[2];
	res.writeHead(200, {"Content-Type": "text/html"});   
	  var student_tpl = nTPL("./templates/epoch-student-v2.html");
	  var base = nTPL("./templates/boilerplate-ntpl.html");
	  res.end(student_tpl({
	      channel: chan,
	    }));
});


fu.getterer("/classmoderator/[\\w\\.\\-]+", function(req, res) {
	var chan = url.parse(req.url).pathname.split("/")[2];
	var contentlist = fu.pullcontent(CONTENT_REPO_FILE_PATH, CONTENT_REPO_URL, chan);
	var roomcl = JSON.stringify(contentlist);
		
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
  if (nick == null || nick.length == 0) {
    res.simpleJSON(400, {error: "Bad nick."});
    return;
  }
  var session = createSession(nick);
  if (session == null) {
    res.simpleJSON(400, {error: "Nick in use"});
    return;
  }

  //sys.puts("connection: " + nick + "@" + res.connection.remoteAddress);

  channel.appendMessage(session.nick, "join");
  res.simpleJSON(200, { id: session.id
                      , nick: session.nick
                      , rss: mem.rss
                      , starttime: starttime
                      });
});

fu.get("/part", function (req, res) {
  var id = qs.parse(url.parse(req.url).query).id;
  var session;
  if (id && sessions[id]) {
    session = sessions[id];
    session.destroy();
  }
  res.simpleJSON(200, { rss: mem.rss });
});

fu.get("/recv", function (req, res) {
  if (!qs.parse(url.parse(req.url).query).since) {
    res.simpleJSON(400, { error: "Must supply since parameter" });
    return;
  }
  var id = qs.parse(url.parse(req.url).query).id;
  var session;
  if (id && sessions[id]) {
    session = sessions[id];
    session.poke();
  }

  var since = parseInt(qs.parse(url.parse(req.url).query).since, 10);

  channel.query(since, function (messages) {
    if (session) session.poke();
    res.simpleJSON(200, { messages: messages, rss: mem.rss });
  });
});

fu.get("/send", function (req, res) {
  var id = qs.parse(url.parse(req.url).query).id;
  var text = qs.parse(url.parse(req.url).query).text;
  var type = qs.parse(url.parse(req.url).query).type;

  if (!type) type = "msg";
  sys.puts("send received message type = " + type);
  var session = sessions[id];
  if (!session || !text) {
    res.simpleJSON(400, { error: "No such session id" });
    return;
  }

  session.poke();

  if (text != null && text.match(/#startsession/i)) {
	channel.appendMessage(session.nick, "startsession", text);
  } else if (text != null && text.match(/#endsession/i)) {
		channel.appendMessage(session.nick, "endsession", text);
  } else {
  	channel.appendMessage(session.nick, type, text);
  }
  res.simpleJSON(200, { rss: mem.rss });
});

