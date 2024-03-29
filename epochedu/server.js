/**
#
#Copyright (c) 2010-2012, 2014 Razortooth Communications, LLC. All rights reserved.
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
// CONTENT_REPO_URL = "http://localhost:5000/content"; // XXX Just figure out the IP address
CONTENT_REPO_URL = null;  // If not set, then default to /content
//
// CONTENT_REPO_FILE_PATH - the base path to look into for a directory mapping to classroom
//
// CONTENT_REPO_FILE_PATH = "/var/www/mediafiles";
CONTENT_REPO_FILE_PATH = "./contentrepo";
// CONTENT_REPO_FILE_PATH = "/Users/dkords/Pictures"; 
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
CONTENT_REPO_LOCAL_URL = "content://com.android.htmlfileprovider/sdcard/content"; // XXX This is fixed for android!!!! -> No it's not, I think it's broken since 4.x.

// DEFAULT_CHANNELS = ['science', 'math', 'history', 'spanish']; // XXX DEMOSETUP
DEFAULT_CHANNELS = ['science'];
//
// INTERVALS & TIMEOUT VALUES
//
// XXX TODO

// when the daemon started
var starttime = (new Date()).getTime();
//
// VERSION - generic version string for support and QA
//
VERSION = "epochedu-smile-postces2014-presale-b1" + starttime ;  // XXX Can  we instrument this using hudson during packaging, maybe use commit GUID
WIP = " <li>Post CES FSD160 Work</li>\n \
";
var DEFAULT_CHANNEL = 'default';
var BOTNICK = "robot"
var BOTID = -2001; // XXX We could generate it each time, but uh, dunno , I like the bot to be 2001.  Our random numbers will never generate this
var mem = process.memoryUsage();

//
// Some other global settings
//
var STUDENT_SCREENSHARE_PORT='8080';
var STUDENT_SCREENSHARE_ENDPOINT = '/screengrab?rand=';

// 
// System Status 
//
// every 10 seconds poll for the memory.
setInterval(function () {
  mem = process.memoryUsage();
}, 10*1000);

var JS =  require('js.js').JS,
	sys = require("sys"),
	url = require("url"),
	util = require("util"),
	qs = require("querystring"),
	path = require("path"),
	fs = require("fs"),
	nTPL = require("nTPL").plugins("nTPL.block", "nTPL.filter").nTPL;

var MESSAGE_BACKLOG = 200,
    SESSION_TIMEOUT = 60 * 1000 * 5; // XXX 1000ms = 1 s * 60 * 5 = 5 minutes - this should be configurable

var js = new JS();
js.CONFIG['DOCROOT'] = './';
process.chdir(__dirname);
console.log("Working directory is " + __dirname); // XXX Move this to js.js
//
// Override Default CONFIG
//
js.CONFIG['HTTPWS_PORT'] = 5000;

var db = {};
var channels = {}; // XXX Load from DB instead!!!
var channelstates = {'NOT_IN_CLASS': 0, 'IN_CLASS': 1};
// fu.initDB([], broadcastRestart); // XXX empty options, handler

var dkqs = {
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
				var match = item.match(dkqs.RE_OBJS["RE_ARRAYOBJ"]);
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

function channelFactory() {
	var channel = new function () {
		var messages = [],
			callbacks = [];
		this.sessions = {};
		this.createdate = new Date();
		this.state = channelstates['NOT_IN_CLASS'];
		this.appendMessage = function (nick, id, type, text, payload) {
		var m;
		var dm;

		// 
		// XXX OK, this is extremely double effort if we already have this nice case statement below
		// Work this out what is the right thing to do ... I think move this into some kind of standard handler
		if (type != "mcprequest") {
			sys.puts('Received regular message type = ' + type + ' with payload = ' + JSON.stringify(payload));
			m = { nick: nick
			   , id: id
			   , type: type
			   , text: text
			   , payload: payload
			   , timestamp: (new Date()).getTime()
			};
		} else {
			if (payload) {
				sys.puts('Received mcprequest with payload - ' + JSON.stringify(payload));
				m = { nick: nick
				   , id: id
				   , type: type
				   , text: text
				   , payload: payload
				   , timestamp: (new Date()).getTime()
				};
			} else {
				type = 'mcprequestmissingpayload';
			}
		}

		//
		// MSG DEF
		// We should define the messages, at least document them
		//
		// XXX This switch statement seems completely redundant unless we do error checking and preprocessing
		// XXX I only see a few cases where this is a bit useful
		switch (type) {
			case "msg":
				sys.puts("<" + nick + "> " + text);

				//
				// Make sure we got a real, non-empty DM
				if ((dm = getDMnick(text)) !== undefined && dm !== '@') {
					//
					// Store the ID
					//
					var dmid = this.queryIDByNick(dm);
					console.log("dm received to: " + dm + "(" + dmid + ")");
					m.dmid = dmid;
					console.log(m);
				}
				break;
			case "join":
				sys.puts(nick + " join");
				break;
			case "part":
				sys.puts(nick + " part");
				break;
			case "startsession":
				sys.puts(nick + " startsession");
				this.state = channelstates['IN_CLASS'];
				break;
			case "endsession":
				sys.puts(nick + " endsession");
				this.state = channelstates['NOT_IN_CLASS'];
				break;
			case "dumpsession":
				sys.puts(nick + " dumpsession");
				this.state = channelstates['NOT_IN_CLASS'];
				break;
			case "universalsend":
				sys.puts(nick + " universalsend");
				break;
			case "sendviewer":
				sys.puts(nick + " sendviewer");
				break;
			case "mcprequest":
				sys.puts(nick + " mcprequest");
				break;
			case "askquestion":
				sys.puts(nick + " askquestion");
				break;
			case "sendviewerlocal":
			 	var content_repo = (CONTENT_REPO_URL || ('http://' + js.address + ':' + PORT + '/content'));
				var local_url = text.replace(content_repo, CONTENT_REPO_LOCAL_URL);
			 	sys.puts(nick + " sendviewerlocal, transforming player URL from " + text + 
				" to " + local_url);
				m.text = local_url;
				break;
			case "endviewer":
				sys.puts(nick + " endviewer");
				break;
			case "syncack":
				sys.puts(nick + " syncack");
				break;
			default:
				sys.puts('unhandled message type ' + type + ' received');
		}

	    messages.push( m );

	    while (callbacks.length > 0) {
			callbacks.shift().callback([m]);
	    }

	    while (messages.length > MESSAGE_BACKLOG)
	      messages.shift();
	
		if (type == "dumpsession") { // Dump old messages in backlog
			console.log("dumpsession invoked");
			messages = [];
			this.sessions = {};
			callbacks = [];
			//
			// This might be kind of abrupt
			//
		}
  };

  this.query = function (since, callback, id) {
    var matching = [];
    // XXX I'm not sure what conditions are that we'd have timestamp > since
    for (var i = 0; i < messages.length; i++) {
    	// console.log("Looping on message " + i);
      	var message = messages[i];
      	// console.log(message);
      	if (message.timestamp > since) {
      		matching.push(message);
      		/* if (message.dmid === undefined) {
      			sys.puts("got a group message, push");
        		matching.push(message);
        	} else if (message.dmid === id) {
        		sys.puts("Delivering DM to recipient id = " + id);
        		matching.push(message);
        	} else {
        		// NOOP, ignore the message
        		sys.puts("Don't deliver to id = " + id);
        	} */
     	}
    }

    // console.log(matching);
    if (matching.length != 0) {
    	// sys.puts("Return matching message length = " + matching.legnth);
		callback(matching);
    } else {
    	// sys.puts("Return no matching");
		callbacks.push({ timestamp: new Date(), callback: callback });
    }
  };

  this.queryIDByNick = function(nick) {
	  for (var id in this.sessions) {
	    if (!this.sessions.hasOwnProperty(id)) continue;
	    var session = this.sessions[id];
	    if (session.nick === nick) {
	    	return id;
	    }
	  }
	  return undefined;
  };

  // A Simple wrapper message to broadcast something important from the server
  this.botMessage = function (text) {
      this.appendMessage(BOTNICK, BOTID, 'msg', text); // XXX Until we come up with a new message type, use basic 'msg'
  }

  // clear old callbacks
  // they can hang around for at most 30 seconds.
  setInterval(function () {
    var now = new Date();
    while (callbacks.length > 0 && now - callbacks[0].timestamp > 30*1000) {
	  // sys.puts('clearing old callbacks for date: ' + new Date(callbacks[0].timestamp));
      callbacks.shift().callback([]);
    }
  }, 3000);
};
	return channel;
} // channelFactory
	
function sessionFactory (nick, chan, address) {
  if ((nick.length > 50) || (nick == BOTNICK)) return null;
  if (/[^\w_\-^!]/.exec(nick)) return null;
  
  var channel = channels[chan];
  var sessions;
  
  if (channel == null) sessions = {}; else sessions = channel.sessions;
	  
  for (var i in sessions) {
    var session = sessions[i];
	if (session && session.nick === nick) return session; // Just rejoin!!! 
    // if (session && session.nick === nick) return null; // XXX Why do we not simply rejoin?  We should at least respond with an affirmative
  }

  var session = { 
    nick: nick, 
    id: Math.floor(Math.random()*99999999999).toString(),
    timestamp: new Date(),
    address: address,
    poke: function () {
      session.timestamp = new Date();
    },

    destroy: function () {
      channel.appendMessage(session.nick, session.id, "part");
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

/* 
	loadChannels()
	XXX Todo: add a callback to handle db load error 
	Channel Document
	{
		sessionkeys: ['key1', 'key2', ... , 'keyN'],
		timestamp: 'Date String'
	}
*/
/* 
function loadChannels() {
	// XXX I was going to load it all into memory, but the framework actually does that 
	// already.
	return fu.db['channels'];
} */

/* 
	loadSessions()
	XXX Todo: add a callback to handle db load error 
	Session Document - see code about where this is defined
	{ 
	    nick: nick, 
	    id: Math.floor(Math.random()*99999999999).toString(),
	    timestamp: new Date(),
	}
*/
/*
function loadSessions() {
	return fu.db['sessions'];
} */

/*
function broadcastRestart() {
	sys.puts('broadcastRestart');
	fu.db['channels'].forEach(function(key, val) {
	    // console.log('broadcastRestart: Found key: %s, val: %j', key, val);
		var chan = channels[key];
		if (chan) {
			chan.botMessage('Restarted Server');
		}
	});
} */


// fu.listen(Number(process.env.PORT || PORT), HOST);


//
// ===============================================
// Route Setup
// ===============================================
//

// 
// TEST ROUTES, REMOVE LATER
//
js.get("/", function( req, res ) {
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

js.get("/hello-test-nTPL", function( req, res ) {
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

js.get("/hello-test2-nTPL", function( req, res ) {
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

js.get("/helloworld", function(req, res) {
	var body = 'hello world';
	res.writeHead(200, {
	  'Content-Length': body.length,
	  'Content-Type': 'text/plain'
	});
	res.write(body);
	res.end();
});



js.get("/testdirty", function(req, res) {
	var body = "wrote out 'john', {eyes: 'blue'}";
	// fu.db['channels'].set('testchannel', {timestamp: new Date(), sessionkeys: []});
	
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
// XXX Need a default / route, maybe a splash page
js.get("/tester", js.staticHandler("templates/tester.html")); // XXX TODO: Add a default chat room

js.getterer("/static/[\\w\\.\\-]+", function(req, res) {
	return js.staticHandler("." + url.parse(req.url).pathname)(req, res);
});

js.getterer("/templates/[\\w\\.\\-]+", function(req, res) {
	return js.staticHandler("." + url.parse(req.url).pathname)(req, res);
});

js.getterer("/fonts/[\\w\\.\\-]+", function(req, res) {
	return js.staticHandler("." + url.parse(req.url).pathname)(req, res);
});

js.getterer("/content/[\\w\\.\\-]+", function(req, res) {
	var syncnick = qs.parse(url.parse(req.url).query).syncnick;
	var aurl = req.url;
	// Allow the requestor to encode the nickname into the url... done in the name of efficiency
	// Rather than force the protocol for MCP to carry this information and the MCP to handle the callback
	// XXX Not really sure what is the smartest way, clearly the client could notify if and only if it completes
	// the asynchronous sync.  So this isn't reliable in the case that the MCP Service couldn't sync the content.
	// Do it this way for now because changing the client is trickier and requires 3x more testing than doing it
	// from the server side.
	if (syncnick) { // XXX I don't think I'll use this for now.  Remove it later if we don't need it
		var chan = url.parse(req.url).pathname.split("/")[2];
		aurl = aurl.split('?')[0]; // Drop the query string, as we already have what we need from the request
		var syncdmsg = '@' + syncnick + ' completed sync of content: ' + aurl.substring(aurl.lastIndexOf('/') + 1) + ' on channel: ' + chan;
		sys.puts(syncdmsg);
		chan = channels[chan]
		if (chan) {
			var id = chan.queryIDByNick(syncnick);
			if (!id) console.error("Unable to queryIDByNick(" + syncnick + ")");
			chan.appendMessage(syncnick, id, 'syncack', syncdmsg);
		}
	}
	return js.staticHandler(CONTENT_REPO_FILE_PATH + aurl.substring(aurl.indexOf('/content') + '/content'.length)) (req, res);
});

//
// APP ROUTES
//
js.get("/about", function(req, res) {
	var body = '<H2>EpochEDU version: ' + VERSION + '\nWork in progress:</H2><UL>' + WIP + '</UL>';
	res.writeHead(200, {
	  'Content-Length': body.length,
	  'Content-Type': 'text/html'
	});
	res.write(body);
	res.end();
});




js.getterer("/class-v2/[\\w\\.\\-]+", function(req, res) {
	var chan = url.parse(req.url).pathname.split("/")[2];
	res.writeHead(200, {"Content-Type": "text/html"});   
	  var student_tpl = nTPL("./templates/epoch-student-v2.html");
	  var base = nTPL("./templates/boilerplate-ntpl.html"); // V1
	  res.end(student_tpl({
	      channel: chan,
	    }));
});

js.getterer("/class-v3/[\\w\\.\\-]+", function(req, res) {
	var chan = url.parse(req.url).pathname.split("/")[2];
	res.writeHead(200, {"Content-Type": "text/html"});   
	  var student_tpl = nTPL("./templates/student-jqm-ntpl.html");
	  var base = nTPL("./templates/boilerplate-jqm-ntpl.html"); // JQM
	  res.end(student_tpl({
	      channel: chan,
	    }));
});

js.getterer("/class/[\\w\\.\\-]+", function(req, res) {
	var chan = url.parse(req.url).pathname.split("/")[2];
	res.writeHead(200, {"Content-Type": "text/html"});   
	  var student_tpl = nTPL("./templates/epoch-student-v3.html");
	  var base = nTPL("./templates/boilerplate-ntpl.html"); // V1
	  res.end(student_tpl({
	      channel: chan,
	    }));
});


js.getterer("/classmoderator-v1/[\\w\\.\\-]+", function(req, res) {
	var chan = url.parse(req.url).pathname.split("/")[2];
	var contentlist = pullcontent(CONTENT_REPO_FILE_PATH, (CONTENT_REPO_URL || ('http://' + js.address + ':' + PORT + '/content')), chan);
	var roomcl = JSON.stringify(contentlist); // V1
		
	res.writeHead(200, {"Content-Type": "text/html"});   
	  var teacher_tpl = nTPL("./templates/epoch-teacher-v3.html");
	  var base = nTPL("./templates/boilerplate-ntpl.html");
	  res.end(teacher_tpl({
	      channel: chan,
		  roomcl: roomcl,
	    }));
});

js.getterer("/classmoderator-v2/[\\w\\.\\-]+", function(req, res) {
	var chan = url.parse(req.url).pathname.split("/")[2];
	var contentlist = pullcontent(CONTENT_REPO_FILE_PATH, (CONTENT_REPO_URL || ('http://' + js.address + ':' + PORT + '/content')), chan);
	var roomcl = JSON.stringify(contentlist); // V1
		
	res.writeHead(200, {"Content-Type": "text/html"});   
	  var teacher_tpl = nTPL("./templates/epoch-teacher-v2.html");
	  var base = nTPL("./templates/boilerplate-ntpl.html");
	  res.end(teacher_tpl({
	      channel: chan,
		  roomcl: roomcl,
	    }));
});

js.getterer("(/student-v3|/teacher-v3)", function(req, res) { // Match either student or teacher URL
	var path = url.parse(req.url).pathname.split("/")[1];
	util.puts('landing page path: ' + path);
	res.writeHead(200, {"Content-Type": "text/html"});   
	  var landing_tpl = nTPL("./templates/epoch-landing.html");
	  var base = nTPL("./templates/boilerplate-jqm-ntpl.html"); // V1
	  res.end(landing_tpl({
	      who: path,
	    }));
});

js.getterer("(/student-v1|/teacher-v1)", function(req, res) { // Match either student or teacher URL
	try {
		var path = url.parse(req.url).pathname.split("/")[1];
		util.puts('landing page path: ' + path);
		res.writeHead(200, {"Content-Type": "text/html"});   
		var landing_tpl = nTPL("./templates/epoch-landing2.html");
		console.log("landing_tpl");
		var base = nTPL("./templates/boilerplate-ntpl.html"); // V1
		console.log("base");
		res.end(landing_tpl({
		      who: path,
		}));
	} catch(e) {
		var stack = new Error().stack;
		console.log(stack);
	}
});

js.getterer("(/student|/teacher)", function(req, res) { // Match either student or teacher URL
	try {
		var path = url.parse(req.url).pathname.split("/")[1];
		util.puts('v4 landing page path: ' + path);
		res.writeHead(200, {"Content-Type": "text/html"});   
		var landing_tpl = nTPL("./templates/epoch-landing3.html");
		console.log("landing_tpl");
		var base = nTPL("./templates/boilerplate2-ntpl.html"); // V2
		console.log("base");
		res.end(landing_tpl({
		      who: path,
		}));
	} catch(e) {
		var stack = new Error().stack;
		console.log(stack);
	}
});

js.getterer("/classmoderator-v3/[\\w\\.\\-]+", function(req, res) {
	var chan = url.parse(req.url).pathname.split("/")[2];
	var contentlist = pullcontent(CONTENT_REPO_FILE_PATH, (CONTENT_REPO_URL || ('http://' + js.address + ':' + PORT + '/content')), chan);
	var roomcl = JSON.stringify(contentlist);
	// sys.puts(chan + ' = ' + roomcl);
	res.writeHead(200, {"Content-Type": "text/html"});   
	  var teacher_tpl = nTPL("./templates/teacher-jqm-ntpl.html");
	  var base = nTPL("./templates/boilerplate-jqm-ntpl.html"); // JQM
	  res.end(teacher_tpl({
	      channel: chan,
		  roomcl: roomcl,
	    }));
});

js.getterer("/classmoderator/[\\w\\.\\-]+", function(req, res) {
	var chan = url.parse(req.url).pathname.split("/")[2];
	var contentlist = pullcontent(CONTENT_REPO_FILE_PATH, (CONTENT_REPO_URL || ('http://' + js.address + ':' + PORT + '/content')), chan);
	var roomcl = JSON.stringify(contentlist); // V1
		
	res.writeHead(200, {"Content-Type": "text/html"});   
	  var teacher_tpl = nTPL("./templates/epoch-teacher-v4.html");
	  var base = nTPL("./templates/boilerplate2-ntpl.html");
	  res.end(teacher_tpl({
	      channel: chan,
		  roomcl: roomcl,
	    }));
});

js.getterer("/screenmonitor", function(req, res) {
	var ipaddr = qs.parse(url.parse(req.url).query).ipaddress;
	var nickname = qs.parse(url.parse(req.url).query).nick;
	var portno = STUDENT_SCREENSHARE_PORT;
	var endpt = STUDENT_SCREENSHARE_ENDPOINT;

	if (nickname === undefined || nickname === '') {
		nickname = 'student';
	}

	if (ipaddr === undefined || ipaddr === '') {
		res.simpleJSON(400, {error: "Bad ipaddress query parameter"});
	} // XXX TODO: We should validate the IP as well

	res.writeHead(200, {"Content-Type": "text/html"});   
	  var screenmonitor_tpl = nTPL("./templates/epoch-screenmonitor.html");
	  var base = nTPL("./templates/boilerplate-ntpl.html");
	  res.end(screenmonitor_tpl({
	      ipaddress: ipaddr,
	      nick: nickname,
	      port: portno,
	      endpoint: endpt
	    }));
});

js.getterer("/epochtester/[\\w\\.\\-]+", function(req, res) {
	var chan = url.parse(req.url).pathname.split("/")[2];
	var contentlist = pullcontent(CONTENT_REPO_FILE_PATH, (CONTENT_REPO_URL || ('http://' + js.address + ':' + PORT + '/content')), chan);
	var roomcl = JSON.stringify(contentlist);
	// sys.puts(chan + ' = ' + roomcl);
	res.writeHead(200, {"Content-Type": "text/html"});   
	  var teacher_tpl = nTPL("./templates/epochtester.html");
	  var base = nTPL("./templates/boilerplate-ntpl.html"); // JQM
	  res.end(teacher_tpl({
	      channel: chan,
		  roomcl: roomcl,
	    }));
});

js.getterer("/crdb/[\\w\\.\\-]+", function(req, res) {
	var requrlobj = url.parse(req.url);
	var chan = requrlobj.pathname.split("/")[2];
	var host = requrlobj.host;
	var output = qs.parse(requrlobj.query).output;
	var contentlist;
	
	// Load all of the content from disk
	contentlist = pullcontent(CONTENT_REPO_FILE_PATH, (CONTENT_REPO_URL || ('http://' + js.address + ':' + PORT + '/content')), chan);
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

js.getterer("/syncack/[\\w\\.\\-]+", function(req, res) {
	var requrlobj = url.parse(req.url);
	var chan = requrlobj.pathname.split("/")[2];
	var syncnick = qs.parse(requrlobj.query).syncnick;
	var fname = qs.parse(requrlobj.query).fname;
	
	sys.puts('/syncack @' + syncnick + ' content = ' + fname)
	var syncdmsg = '@' + syncnick + ' completed sync of content: ' + fname + ' on channel: ' + chan;
	sys.puts(syncdmsg);
	chan = channels[chan]
	if (chan) {
		var id = chan.queryIDByNick(syncnick);
		if (!id) console.error("Unable to queryIDByNick(" + syncnick + ")");
		chan.appendMessage(syncnick, id, 'syncack', syncdmsg);
	}
	res.simpleJSON(200, { rss: mem.rss });
});

js.get("/who", function (req, res) {
  var nicks = [];
  var chan = qs.parse(url.parse(req.url).query).channel;
  var sessions = channels[chan].sessions;
  	
  for (var id in sessions) {
    if (!sessions.hasOwnProperty(id)) continue;
    var session = sessions[id];
    nicks.push(session.nick);
  }
  res.simpleJSON(200, { nicks: nicks,
  						address: js.address,
  						port: js.CONFIG['HTTPWS_PORT'],
                      	rss: mem.rss
                      });
});


js.get("/join", function (req, res) {
  var nick = qs.parse(url.parse(req.url).query).nick;
  var chan = qs.parse(url.parse(req.url).query).channel;
  var achannel = channels[chan];

  if (nick == null || nick.length == 0) {
	sys.puts('Error 400: bad nock');
    res.simpleJSON(400, {error: "Bad nick."});
    return;
  }
  var session = sessionFactory(nick, chan, res.connection.remoteAddress);
  // XXX Cleanup this error handling!!!!!
  if (!channels[chan]) {
	channels[chan] = channelFactory();
	sys.puts('channelFactory invoked for @' + chan);
	// fu.db['channels'].set(chan, {timestamp: new Date(), sessionkeys: []});
  }
  if (!channels[chan]) {
	  res.simpleJSON(400, {error: "Unable to create channel for " + chan}); // can I just return this resp?
	  return;
  } else if (session == null){
	sys.puts('Error: cannot create session');
    res.simpleJSON(400, {error: "cannot create session for some reason", code: 1});
    return;
	/* else if (session == null) { // XXX Need to clean up the handling of "nick in use"
    sys.puts('Error: nick in use');
    res.simpleJSON(400, {error: "Nick in use", code: 1});
    return;
   */ }  else {
	  channels[chan].sessions[session.id] = session;
	  // fu.db['sessions'].set(session.id, {id: session.id, nick: session.nick, timestamp: session.timestamp, channel: chan});
  }

  sys.puts("connection: " + nick + "@" + res.connection.remoteAddress + " on " + chan);

  channels[chan].appendMessage(session.nick, session.id, "join", "usermeta[" + nick + "]", { address: res.connection.remoteAddress });
  res.simpleJSON(200, { id: session.id
                      , nick: session.nick
                      , address: res.connection.remoteAddress
                      , rss: mem.rss
                      , starttime: starttime
					  , channelstate: channels[chan].state
                      }); // XXX What is channel state?
});

js.get("/rejoin", function (req, res){
	var sessionid = qs.parse(url.parse(req.url).query).id;
	var chan = qs.parse(url.parse(req.url).query).channel;
	var session,
	 	sessions,
		nick;
	sys.puts('rejoin called');
	if (!sessionid) {
		sys.puts('/rejoin Error 400: Missing session id');
		res.simpleJSON(400, {error: '/rejoin Error 400: Missing session id'});
	} 
	
	if ((!chan) || (chan.length == 0)) {
		chan = DEFAULT_CHANNEL;
	}
	
	if (!channels[chan]) channels[chan] = channelFactory();
	sys.puts('channelFactory invoked for @' + chan);
	sessions = channels[chan].sessions;
	if ((!sessions) || !(sessions[sessionid])) {
		// XXX this doesn't properly work ... so don't use it session = fu.db['sessions'].get(sessionid);
		session = null;
	} else {
		session = sessions[sessionid];
	}
		
	if (session == null) {
		sys.puts('/rejoin Error 400: Session Undefined for id');
		sys.log(sys.inspect(channels, true, null));
		res.simpleJSON(400, {error: '/rejoin Error 400: Session Undefined for id'});
	}
	channels[chan].appendMessage(session.nick, session.id, "join");
	res.simpleJSON(200, { id: session.id
	                      , nick: session.nick
	                      , rss: mem.rss
	                      , starttime: starttime
	                      });
	
	res.simpleJSON(200, { nick: session.nick});
});

js.get("/part", function (req, res) {
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

js.get("/channels", function (req, res) {
  	// var id = qs.parse(url.parse(req.url).query).id;
	// Setup the default channels if they don't exist
	var channelslist = {};
	
	for (var i = 0; i < DEFAULT_CHANNELS.length; i++) {
		if (!channels[DEFAULT_CHANNELS[i]]) {
			// Add it
			var achannel = channelFactory();
			sys.puts('channelFactory invoked for @' + DEFAULT_CHANNELS[i]);
			channels[DEFAULT_CHANNELS[i]] = achannel;
		}
	}
	
	var contentdirlist = pullcontentdirs(CONTENT_REPO_FILE_PATH);
	
	for (var i = 0; i < contentdirlist.length; i++) {
		if (!channels[contentdirlist[i]]) {
			var achannel = channelFactory();
			sys.puts('channelFactory invoked for @' + contentdirlist[i]);
			channels[contentdirlist[i]] = achannel;
		}
	}
	
	for (i in channels) {
		if (channels[i].sessions) {
			var count = 0;
			for (ses in channels[i].sessions) {
				count = count + 1;
			}
			channelslist[i] = count;
		}
		// sys.log('channelslist is ' + JSON.stringify(channelslist));
	}
             
	// sys.log('channelslist is ' + JSON.stringify(channelslist));
  	res.simpleJSON(200, channelslist);
});

js.get("/defaultchannels", function (req, res) {
  	// var id = qs.parse(url.parse(req.url).query).id;
	// Setup the default channels if they don't exist
	var channelslist = {};
	
	for (var i = 0; i < DEFAULT_CHANNELS.length; i++) {
		if (!channels[DEFAULT_CHANNELS[i]]) {
			// Add it
			var achannel = channelFactory();
			sys.puts('channelFactory invoked for @' + DEFAULT_CHANNELS[i]);
			channels[DEFAULT_CHANNELS[i]] = achannel;
		}
	}
	
	for (i in channels) {
		if (channels[i].sessions) {
			var count = 0;
			for (ses in channels[i].sessions) {
				count = count + 1;
			}
			channelslist[i] = count;
		}
		// sys.log('channelslist is ' + JSON.stringify(channelslist));
	}
             
	// sys.log('channelslist is ' + JSON.stringify(channelslist));
  	res.simpleJSON(200, channelslist);
});


/*
	/info

	Call this to get basic server info
	Should include things like server version
*/
js.get("/info", function (req, res) {
	res.simpleJSON(200, {
		address: js.address,
  		port: js.CONFIG['HTTPWS_PORT'],
	});
});

js.get("/recv", function (req, res) {
  var chan = qs.parse(url.parse(req.url).query).channel;
  // XXX Clean up this mess
  if (chan == null) {
	 sys.puts('channel is null');
	 return res.simpleJSON(400, {error: "Must provide a channel"}); // XXX Need to just provide a default channel
  }
  var achannel = channels[chan];
  var sessions;
  var state = 0;
  // sys.puts("channel is " + chan);
  if (achannel == null) {
	  // sys.puts("Creating new channel for " + chan);
	  achannel = channelFactory();
	  sys.puts('channelFactory invoked for @' + chan);
	  if (achannel != null) {
	  	channels[chan] = achannel;
		// fu.db['channels'].set(chan, {timestamp: new Date(), sessionkeys: []});
  	  } else {
		sys.puts('/recv achannel is null');
	  }
	  
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
  } else {
		state = -1;
  }
  // sys.puts('/recv setting since');
  
  var since = parseInt(qs.parse(url.parse(req.url).query).since, 10);

  achannel.query(since, function (messages) {
  	for (var i = 0; i < messages.length; i++) {
	    if (messages[i].dmid !== undefined) {
	    	if (messages[i].dmid === id) continue;
	    	if (messages[i].id === id) continue;
	    	sys.puts("Don't deliver DM to id = " + id);
	    	messages.splice(i, 1);
    	}
	}
    // sys.puts("channel session query");
    if (session) session.poke();
    res.simpleJSON(200, { messages: messages, rss: mem.rss, state: state });
  }, id);
  // sys.puts("Done with /recv");
});

js.get("/send", function (req, res) {
  var query = url.parse(req.url).query;
  var uqs = qs.unescape(query);
  var querystring = qs.parse(query); // XXX This fails on the PLUG :( barf on my face ):
  var id = querystring.id;
  var text = querystring.text;
  var type = querystring.type;
  var chan = querystring.channel;
  var payload = querystring.payload;
  var channel = channels[chan];
  var sessions = channel.sessions;
  
  // sys.puts('Received message ' + type);
  // sys.puts('Payload is ' + payload);
  // sys.puts('/send with unescaped query string = ' + uqs);
  // sys.puts('/send with querystringified = ' + JSON.stringify(querystring));
  // sys.puts('/send with dkqs = ' + JSON.stringify(fu.dkqs.getJSON(uqs)));
  if (!payload) payload = dkqs.getJSON(uqs).payload; // XXX I would love to know why node's querystring doesn't work
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
  
  if ((type == "msg") && (!text)) {
	sys.puts('Error 400: empty message not allowed');
    res.simpleJSON(400, { error: "empty message not allowed" });
    return;
  }

  session.poke();
  channel.appendMessage(session.nick, id, type, text, payload); // Pass the error handling on down 
  res.simpleJSON(200, { rss: mem.rss });
});

//
// Some local utility functions
//
function renamelocalfile(from, to, handler) {
	fs.rename(from, to, handler); // XXX This needs and deserves tons and tons of security :(
}

function pullcontentdirs(crdbpath) {
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

// XXX Get rid of this dirtydb and replace with pouchdb
function initDB(options, handler) {
	var self = this;
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
	self.db['channels'] = channels_db;
	self.db['sessions'] = sessions_db;
	setTimeout(handler, SERVER_RESTART_TIMEOUT); // Give the existing channels time to be recreated
}

function pullcontent(crdbpath, crdburl, chan) {
	// XXX This should get cached intelligently so you don't do file IO for each call unless cache is dirty

	var dirpath = "";
	var contentlist = [ ];
	var filter = /xml|db|^\./i; // XXX DEMOSETTING put this somewhere else
	if (chan) {
		dirpath = "/" + chan;
	}
	console.log('Pulling content from: ' + crdbpath + dirpath + ' from base cwd: ' + path.resolve());
	var dircontents = [];
	
	try {
		dircontents = fs.readdirSync(crdbpath + dirpath); // XXX Can we make this more performant async, also, use a DB
	} catch(err) {
		console.error('Error getting content from pullcontent, reason: ' + err);
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

function getDMnick(msg) {
	var RE_DM = /\@(\/?)(\w+)([^>]*?)/;
	var dmnick = undefined;
	if (RE_DM.test(msg)) {
		dmnick = msg.substring(1, msg.indexOf(' '));
	}
	return dmnick;
}

console.log(js.CONFIG);
js.create(js.address, js.CONFIG['HTTPWS_PORT']);
js.listenHttpWS();
js.listenSocketIO(js.js_handler); // This is initially set to null, so it will fallback to use js.DEFAULT_JS_HANDLER
