/**
#Created by David J. Kordsmeier on 2009-01-30.
#Copyright (c) 2009 Razortooth Communications, LLC. All rights reserved.
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
var CONFIG = { debug: false
             , nick: "#"   // set in onConnect
             , id: null    // set in onConnect
             , last_message_time: 1
             , focus: true //event listeners bound in onConnect
             , unread: 0 //updated in the message-processing loop
             };

var nicks = [];
var teacher = false;
var isClassInSession = false;
var EPOCH_COOKIE = "epochedu_cookie";
var COOKIE_TIMEOUT_IN_MILLIS = 60 * 60 * 1000; // 1 hour 
var VERIFY_SESSION_INTERVAL_IN_MILLIS = 30000; // 1hour 
var LONG_POLL_ERROR_MAX_RETRY = 10; // 10 retries before logout of session
var SHADOWBOX_CONFIG_TITLE = 'Media Player';
var SHADOWBOX_CONFIG_PLAYER = 'iframe';
var SHADOWBOX_CONFIG_WIDTH = 800;
var SHADOWBOX_CONFIG_HEIGHT = 600;
var MCP_RPC_PORT = '8080';  // Assume MCP runs on localhost
var MCP_RPC_ENDPOINT = '/rpc';
var SYNC_FOLDER_ENDPOINT = '/contentsyncpull';

//  CUT  ///////////////////////////////////////////////////////////////////
/* This license and copyright apply to all code until the next "CUT"
http://github.com/jherdman/javascript-relative-time-helpers/

The MIT License

Copyright (c) 2009 James F. Herdman

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


 * Returns a description of this past date in relative terms.
 * Takes an optional parameter (default: 0) setting the threshold in ms which
 * is considered "Just now".
 *
 * Examples, where new Date().toString() == "Mon Nov 23 2009 17:36:51 GMT-0500 (EST)":
 *
 * new Date().toRelativeTime()
 * --> 'Just now'
 *
 * new Date("Nov 21, 2009").toRelativeTime()
 * --> '2 days ago'
 *
 * // One second ago
 * new Date("Nov 23 2009 17:36:50 GMT-0500 (EST)").toRelativeTime()
 * --> '1 second ago'
 *
 * // One second ago, now setting a now_threshold to 5 seconds
 * new Date("Nov 23 2009 17:36:50 GMT-0500 (EST)").toRelativeTime(5000)
 * --> 'Just now'
 *
 */
Date.prototype.toRelativeTime = function(now_threshold) {
  var delta = new Date() - this;

  now_threshold = parseInt(now_threshold, 10);

  if (isNaN(now_threshold)) {
    now_threshold = 0;
  }

  if (delta <= now_threshold) {
    return 'Just now';
  }

  var units = null;
  var conversions = {
    millisecond: 1, // ms    -> ms
    second: 1000,   // ms    -> sec
    minute: 60,     // sec   -> min
    hour:   60,     // min   -> hour
    day:    24,     // hour  -> day
    month:  30,     // day   -> month (roughly)
    year:   12      // month -> year
  };

  for (var key in conversions) {
    if (delta < conversions[key]) {
      break;
    } else {
      units = key; // keeps track of the selected key over the iteration
      delta = delta / conversions[key];
    }
  }

  // pluralize a unit when the difference is greater than 1.
  delta = Math.floor(delta);
  if (delta !== 1) { units += "s"; }
  return [delta, units].join(" ");
};

/*
 * Wraps up a common pattern used with this plugin whereby you take a String
 * representation of a Date, and want back a date object.
 */
Date.fromString = function(str) {
  return new Date(Date.parse(str));
};

//  CUT  ///////////////////////////////////////////////////////////////////

//
// dateInFutureMilliseconds() - use to add milliseconds to an existing date
//
function dateInFutureMilliseconds(aDate, milliseconds) {
	if (aDate.constructor != Date) return undefined;
	if (!(typeof milliseconds == 'number')) return undefined;
	aDate.setUTCMilliseconds(aDate.getUTCMilliseconds() + milliseconds);
	return aDate; 
}

function isEpochCookieSet() {
	// alert('cookie value = ' + $.cookie(EPOCH_COOKIE));
	return $.cookie(EPOCH_COOKIE);
}

function invalidateEpochCookie() {
	// alert('invalidateEpochCookie');
	if ($.cookie) $.cookie(EPOCH_COOKIE, null, {path: '/class'});
}


function verifyEpochCookie(sessionid) {
	var nick;
	$.ajax({ cache: false
	           , type: "GET" // XXX should be POST
	           , dataType: "json"
	           , url: "/rejoin"
	           , data: { id: sessionid, channel: getChannel() }
	           , error: function (xhr, text, err) {
					// alert('cannot rejoin');
					invalidateEpochCookie(sessionid);
					showLogin(getChannel());
	             }
	           , success: onConnect
	           });
	if (nick) return nick;
	return undefined; 
}

function setEpochCookie(sessionid, startdate) {
	// $.cookie(EPOCH_COOKIE, sessionid, { path: '/class', expires: dateInFutureMilliseconds(startdate, COOKIE_TIMEOUT_IN_MILLIS) }); // XXX We may want to make the path configurable as an arg
	$.cookie(EPOCH_COOKIE, sessionid);
	// alert('setting epochedu cookie = ' + $.cookie(EPOCH_COOKIE));
}

function isLoggedIn() {
	var sessionid = isEpochCookieSet();
	var nick = CONFIG.nick;
	if (!sessionid) {
		// alert('not isLoggedIn');
		return undefined;
	} else {
		// alert('isLoggedIn');
		return sessionid;
	}
}

function partSession() {
	if (CONFIG.id) {
		jQuery.get("/part", {id: CONFIG.id, channel: getChannel()}, function (data) { }, "json");
	} 
}

function displayLogin() {
	var channel = getChannel();
	var usertype;
	if (isTeacher()) usertype = "Teacher's"; else usertype = "Student's";
	
	setStatusMessage('#loginform', ' ', 'status');
	$('#dialog').find('#waiting').remove();
	$.mobile.changePage("loginpanel", "fade");
	$("#loginpanel").find("span#channel").html("<em>" + channel + "</em>");
	$("#loginpanel").find("span#usertype").html("<em>" + usertype + "</em>");
}

function doLogout() {
	partSession();
	displayLogin();
}

function logoutSession() {
	invalidateEpochCookie();
	partSession();
	showLogin(getChannel());
}

function showLogin(channel) {
	var usertype;
	setStatusMessage('#loginform', ' ', 'status');
	$('#dialog').find('#waiting').remove();
	$('#loginform').show();
	if (isTeacher()) usertype = "Teacher's"; else usertype = "Student's";
	$.mobile.changePage("loginpanel", "slideup");
	$("#loginpanel").find("span#channel").html("<em>" + channel + "</em>");
	$("#loginpanel").find("span#usertype").html("<em>" + usertype + "</em>");
}

function verifySession(sessionid) {
	var nick;
	$.ajax({ cache: false
	           , type: "GET" // XXX should be POST
	           , dataType: "json"
	           , url: "/isalive"
	           , data: { id: sessionid, channel: getChannel() }
	           , error: function (xhr, text, err) {
					invalidateEpochCookie();
					// XXX DEBUGON if (!first_poll) addMessage("", "Session is invalid, you won't be able to send messages but you can observe...probably server restarted, please cmd://refresh", new Date(), "error");
					// alert('Session is not alive: ');
	             }
	           , success: function(data) {	 		 
			 	 } 
	           });
	return; 
}


//updates the users link to reflect the number of active users
function updateUsersLink ( ) {
  var t = nicks.length.toString() + " student";
  if (nicks.length != 1) t += "s";
  $("#usersLink").text(t);
}

function updateUserStatus(nick, timestamp) {
	if (timestamp > 0) {
		if ((nick != CONFIG.nick) && (CONFIG.nick != '#')){ // Only update if it's not the teacher
			$('li#waiting').remove();
			if ($('#userstatus > li').length > 0) {
				if ($('li#' + nick).length == 0) { // Only update if nick is not in list
					$('#userstatus').append('<li id="' + nick + '"class="online"><a href="#oneononechat" data-rel="dialog">' + nick +' in class since ' + new Date(timestamp) + '</a></li>');
				}
			} else {
				$('#userstatus').append('<li id="' + nick + '"class="online"><a href="#oneononechat" data-rel="dialog">' + nick +' inc class since ' + new Date(timestamp) + '</a></li>');
			}
		}
	} else { // Remove from the list
		$('li#' + nick).remove();
		if ($('#userstatus > li').length == 0) {
			$('#userstatus').append('<li id="waiting">Waiting for students to join</li>');
		}
	}
	if ($.mobile) {
		$('#userstatus').listview('refresh'); // Refresh the listview
	}
}

function isUserInSession() {
	// alert('checking if user is in session');
	for (var i = 0; i < nicks.length; i++) // XXX Put this data into a DB so lookup is quick
	    if (nicks[i] == CONFIG.nick) return true;
	return false;
}
//handles another person joining chat
function userJoin(nick, timestamp) {
  //put it in the stream
  addMessage(nick, "joined", timestamp, "join");
  //if we already know about this user, ignore it
  for (var i = 0; i < nicks.length; i++) // XXX Put this data into a DB so lookup is quick
    if (nicks[i] == nick) return;
  //otherwise, add the user to the list
  nicks.push(nick);
  //update the UI
  updateUsersLink();
  if (teacher) {
  	updateUserStatus(nick, timestamp);
  }
}

function updateAttendanceSheet(page) {
	// Get the attendance list
	var $thispage = page;
	if (nicks.length > 1 ) { // If it is 1, then it's just the teacher :(
		var $ul = $("<ul id='userstatus'>");
		$thispage.find("div[data-role=content] ul").detach();  // remove the existing ul
		$thispage.find("div[data-role=content]").append($ul);  // attach the new ul

		$ul.append('<li data-role="list-divider">Students in classroom: ' + getChannel() + '</li>');
		for (var i = 0; i < nicks.length; i++) {
			if (nicks[i] != CONFIG.nick) { // Don't show teacher
				$ul.append('<li id="'+ nicks[i] + '"><a href="#oneononechat" data-rel="dialog">'+ nicks[i] + ' in class since ' + new Date() + '</a></li>');
			}
		}
		$ul.listview({
		       "inset": true
		});
	}
}
function openNewWindow(url, options) {
	window.open(url);
	return false;
}
//handles someone leaving
function userPart(nick, timestamp) {
  //put it in the stream
  addMessage(nick, "left", timestamp, "part");
  //remove the user from the list
  for (var i = 0; i < nicks.length; i++) {
    if (nicks[i] == nick) {
      nicks.splice(i,1)
      break;
    }
  }
  //update the UI
  updateUsersLink();
  updateUserStatus(nick, -1);
}

// utility functions
function reloadURL()
{
	window.location.reload();
}

util = {
  urlRE: /https?:\/\/([-\w\.]+)+(:\d+)?(\/([^\s]*(\?\S+)?)?)?/g, 
  contenturlRE: /content?:\/\/([-\w\.]+)+(:\d+)?(\/([^\s]*(\?\S+)?)?)?/g, 
  cmdRE: /cmd?:\/\/([-\w\.]+)+(:\d+)?(\/([^\s]*(\?\S+)?)?)?/g, 
  //  html sanitizer 
  toStaticHTML: function(inputHtml) {
    inputHtml = inputHtml.toString();
    return inputHtml.replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
  }, 

  //pads n with zeros on the left,
  //digits is minimum length of output
  //zeroPad(3, 5); returns "005"
  //zeroPad(2, 500); returns "500"
  zeroPad: function (digits, n) {
    n = n.toString();
    while (n.length < digits) 
      n = '0' + n;
    return n;
  },

  //it is almost 8 o'clock PM here
  //timeString(new Date); returns "19:49"
  timeString: function (date) {
    var minutes = date.getMinutes().toString();
    var hours = date.getHours().toString();
    return this.zeroPad(2, hours) + ":" + this.zeroPad(2, minutes);
  },

  //does the argument only contain whitespace?
  isBlank: function(text) {
    var blank = /^\s*$/;
    return (text.match(blank) !== null);
  }
};

//used to keep the most recent messages visible
function scrollDown () {
  window.scrollBy(0, 100000000000000000);
}

//inserts an event into the stream for display
//the event may be a msg, join or part type
//from is the user, text is the body and time is the timestamp, defaulting to now
//_class is a css class to apply to the message, usefull for system events
function addMessage (from, text, time, _class) {
  
  if (text === null)
    return;

  if (time == null) {
    // if the time is null or undefined, use the current time.
    time = new Date();
  } else if ((time instanceof Date) === false) {
    // if it's a timestamp, interpret it
    time = new Date(time);
  }

  // sanitize
  text = util.toStaticHTML(text);

  // replace URLs with links
  
  if (text.match(/http/i)) {
	var rel = "";
	var ext = text.substring(text.lastIndexOf('.') + 1);
	if (ext.match(/png|gif|jpg|html|htm/i)) rel = "shadowbox"; // XXX This should be configurable somwhere obvious?
  	text = text.replace(util.urlRE, '<a target="_blank" rel="' + rel + '" href="$&">$&</a>');
  }
  if (text.match(/cmd/i)) {
	var cmd = text.substring(text.lastIndexOf('/') + 1);
	// text = text.replace(util.cmdRE, '<a target="_blank" href="javascript:' + cmd + '()">' + cmd + '</a>');
	text = text.replace(util.cmdRE, '<a target="_blank" onclick="reloadURL()" href="#">' + cmd + '</a>');
  }
  text = text.replace(util.contenturlRE, '<a target="_blank" href="$&">$&</a>');
  // XXX Remove references to JScrollpane	
  $pane = $('.chatscroll');
  // var autoScroll = $pane.data('jScrollPanePosition') == $pane.data('jScrollPaneMaxScroll'); 
  if (document.jScrollPane) {
  	$pane.append($('<div class="msg"><span class="user">' + util.toStaticHTML(from) + '</span><div class="msgcon">' + text + '</div><div class="ts">' + util.timeString(time) + '</div>')).jScrollPane({scrollbarWidth:20, scrollbarMargin:10});
  } else {
	$pane.append($('<div class="msg"><span class="user">' + util.toStaticHTML(from) + '</span><div class="msgcon">' + text + '</div><div class="ts">' + util.timeString(time) + '</div>'));
  } 
  // alert($pane.data('jScrollPaneMaxScroll') + " v " + $pane.data('jScrollPanePosition'));
  // if (!autoScroll) $pane[0].scrollTo($pane.data('jScrollPaneMaxScroll')); 
  Shadowbox.setup(); // XXX Make sure I still need this
}

function mcpDispatcher(mcpRequest) {
	if (mcpRequest.apdu) {
		var mcpResponse = {
		   apduresp: mcpRequest.ticketid,
		   sender: CONFIG.id,
		   status: '<status code, negative for error conditions, 0 for success>',
		   timestamp: '<isoformat DATETIME>'
		};
		
		// Perform any special handling
		// For now, all we do is dispatch
		// MSGDEF - Student MCP Dispatcher
		// alert('Student incoming MCP apdu ' + mcpRequest.apdu);
		switch(mcpRequest.apdu) {
			case "1":
				break;
			case "2":
				break;
			case "3":
				break;
			case "4":
				break;
			case "5":
				break;
			case "6":
				break;
			default:
				alert('Unhandled MCP apdu type:' + mcpRequest.apdu);
				return false;
		} 
		$.getJSON('http://localhost:' + MCP_RPC_PORT  + MCP_RPC_ENDPOINT + '?jsoncallback=?',
		  mcpRequest,
		  function(data, textStatus) {
		    // alert('sent MCP request type:' + mcpRequest.apdu);
			// XXX Should report back some status here
		  });
	} else {
		alert('No readable MCP apdu received');
	}
}

function updateRSS () {
  var bytes = parseInt(rss);
  if (bytes) {
    var megabytes = bytes / (1024*1024);
    megabytes = Math.round(megabytes*10)/10;
    $("#rss").text(megabytes.toString());
  }
}

function updateUptime () {
  if (starttime) {
    $("#uptime").text(starttime.toRelativeTime());
  }
}

var transmission_errors = 0;
var first_poll = true;


//process updates if we have any, request updates from the server,
// and call again with response. the last part is like recursion except the call
// is being made from the response handler, and not at some point during the
// function's execution.
function longPoll (data) {
  if (transmission_errors > LONG_POLL_ERROR_MAX_RETRY) { // XXX Make this more robust and reconnect opportunistically
    addMessage("", "Too many long poll errors, exceeded " + LONG_POLL_ERROR_MAX_RETRY + ', logout', new Date(), "error");
	setTimeout(logoutSession, 5000); // If we fail to reconnect, show message and then go to login
    return;
  }
  
  if (data && (data.state < 0)) { // XXX Bug here trying to test if session is invalid
		invalidateEpochCookie();
		// XXX DEBUGON if (CONFIG.id) addMessage("", "Session is invalid, you won't be able to send messages but you can observe...probably server restarted, please cmd://refresh", new Date(), "error");
  }

  if (data && data.rss) {
    rss = data.rss;
    updateRSS();
  }

  //process any updates we may have
  //data will be null on the first call of longPoll
  if (data && data.messages) {
    for (var i = 0; i < data.messages.length; i++) {
      var message = data.messages[i];

      //track oldest message so we only request newer messages from server
      if (message.timestamp > CONFIG.last_message_time)
        CONFIG.last_message_time = message.timestamp;

      //dispatch new messages to their appropriate handlers
	  // XXX Add message types here
	  // alert('received ' + message.type);
	  // MSGDEF - longPoll loop
      switch (message.type) {
        case "msg":
          if(!CONFIG.focus){
            CONFIG.unread++;
          }
          addMessage(message.nick, message.text, message.timestamp);
          break;

        case "join":
          userJoin(message.nick, message.timestamp);
          break;

        case "part":
          userPart(message.nick, message.timestamp);
          break;
		
		case "sendurl":
			addMessage(message.nick, message.text, message.timestamp);
		case "sendviewer":
		 	// alert('started a viewer');
			if (!first_poll) {
				var contenturl = message.text;
				if (!contenturl)
					conenturl = 'Sorry, no media is available';
					Shadowbox.open({
						title:      "Media Player",
						player: 'iframe',
						content: contenturl,
						width: 800,
						height: 600
	            });
			}
			break;
		
		case "endviewer":
		 	// alert('ended a viewer');
			if (!first_poll) {
				Shadowbox.close();
				Shadowbox.clearCache();
			}
			break;
				
		case "sendviewerlocal":
			if (!first_poll) {
		 		var contenturl = message.text;
				// alert('received sendviewerlocal ' + contenturl + ' teacher is ' + teacher + ' firstpoll is ' + first_poll);
				// XXX Can we catch the exception?
				if (!teacher) window.open(contenturl);
			}
			break;
			
		case "startsession":
			// alert('started a class');
			isClassInSession = true;
			if (!teacher) {
				if (isUserInSession()) {
					if (!$.mobile) {
						$('#dialog').jqmHide();
						// $('#waiting').text("");
						$('#dialog').find('#waiting').remove();
					} else { // XXX We need to do better than this and know what our UI is
						// alert('Starting the class');
						// $('#loginpanel').
						$('.ui-dialog').dialog('close'); 
						// $('#waiting').text("");
						$('#dialog').find('#waiting').remove();
					}
				}
			} else {
				// DO something in case there are two teachers
			}
			break;
		
		case "endsession":
		 	// alert('ended a class');
			isClassInSession = false;
			if (!teacher) {
				if (isUserInSession()) {
					if ($.mobile) { 
						$.mobile.changePage("loginpanel", "slideup");
						showWaiting(CONFIG.nick);
					} else {	
						$('#dialog').jqmShow();
					}
				}
			}
			break;
		
		case "mcprequest":
			if (($.mobile) && (!teacher)) {
				// alert('mcprequest');
				mcpDispatcher(message.payload);
			}
			break;

		case "askquestion":
			if ((!first_poll ) && (message.nick != CONFIG.nick)){
				var question = message.text;
				$("#nick").text(message.nick);
				$("#question").text(question);
				$('#qadialog').jqmShow();
				// alert('ask a question');
			}
			break;
		default:
			alert('unknown message type: ' + message.type + ' received');
      }
    }
    //update the document title to include unread message count if blurred
    // updateTitle();

    //only after the first request for messages do we want to show who is here
    if (first_poll) {
      first_poll = false;
      who();
    }
  }

  //make another request
  $.ajax({ cache: false
         , type: "GET"
         , url: "/recv"
         , dataType: "json"
         , data: { since: CONFIG.last_message_time, id: CONFIG.id, channel: getChannel() }
         , error: function () {
		   	 var retryDuration = transmission_errors * 10*1000;
             addMessage("", "long poll error. trying again... in " + (retryDuration/1000) + ' seconds', new Date(), "error");
             transmission_errors += 1;
             //don't flood the servers on error, wait 10 seconds * number of transmission_errors before retrying 
             setTimeout(longPoll, retryDuration);
           }
         , success: function (data) {
             transmission_errors = 0;
			 
             //if everything went well, begin another request immediately
             //the server will take a long time to respond
             //how long? well, it will wait until there is another message
             //and then it will return it to us and close the connection.
             //since the connection is closed when we get data, we longPoll again
             longPoll(data);
           }
         });
}

//submit a new message to the server
function send(msg, type) {
  // alert('send called' + msg);
  // jQuery.get("/send", {id: CONFIG.id, text: msg, type: type, channel: getChannel()}, function (data) {}, "json");

  if (CONFIG.debug === false) {
	$.ajax({
		url: "/send",
		data: {id: CONFIG.id, text: msg, type: type, channel: getChannel()},
		success: function(data, textStatus, XMLHttpRequest){
			// alert('Success send');
		},
		complete: function complete(XMLHttpRequest, textStatus){
			// alert('done');
		},
		error: handleError
	});
    // XXX should be POST
    // XXX should add to messages immediately
  //   jQuery.get("/send", {id: CONFIG.id, text: msg, type: type, channel: getChannel()}, function (data) { }, "json");
  }
}

function handleError(myReqObj,textStatus,errorThrown) {
	alert("Error: "+myReqObj.number
		+"\nType: "+textStatus.name
		+"\nDescription: "+errorThrown.description
		+"\nSource Object Id: "+myReqObj.id
	);
}
//push a viewer out to clients XXX This is identical to send :( 
function sendviewer(msg, type) {
  if (CONFIG.debug === false) {
    // XXX should be POST
    // XXX should add to messages immediately
    jQuery.get("/send", {id: CONFIG.id, text: msg, type: type, channel: getChannel()}, function (data) { }, "json");
	
  }
}

//
// This is used to send from teacher to MCP clients
//
function sendmcprequest(msg, type, apdu) {
	if (CONFIG.debug === false) {
		var payload;
		if ((type) && (apdu)) {
			// alert('sendmcprequest with data: ' + msg);
			// The message format is simple.  The message data is contained in an identifier = APDU name
			// payload = '{ apdu: ' + apdu + ', to: "*", requestoruri: "' + CONFIG.nick + '@' + CONFIG.id + '", ticketid: "<unique ticket ID>", ' + type + ': "' + msg + '"}';
	    	// payload = {apdu: apdu};
			// payload = {apdu: apdu, to: '*', requesturi: ' + CONFIG.nick + '@' + CONFIG.id + ', ticketid: '<unique ticket ID>', eval(type): msg};
			// paylod = { eval(type) : msg};
			// payload = {apdu: apdu, to: '*', requesturi: CONFIG.nick + '@' + CONFIG.id, ticketid: '<unique ticket ID>', eval("(" + type + ")"): msg};
			// payload = "{" + type + ": 'xyx' }"; WORKS
			var mcpdata = msg;
			if (!mcpdata) mcpdata = [];
			payload = '{ apdu: ' + apdu + ', to: "*", requestoruri: "' + CONFIG.nick + '@' + CONFIG.id + '", ticketid: "<unique ticket ID>", ' + type + ': "' + mcpdata + '"}';
			// alert('sending payload' + payload);
			// XXX should be POST
			// XXX transmitting via send may not be the right idea ... or, don't put any data into text other than chat 
	    	jQuery.get("/send", {id: CONFIG.id, text: msg, type: 'mcprequest', channel: getChannel(), payload: eval("(" + payload + ")")}, function (data) { }, "json");
		}
	}
}

// XXX Can I modify these to continue to work for this demo?
//Transition the page to the state that prompts the user for a nickname
function showConnect () {
  $("#connect").show();
  $("#loading").hide();
  $("#toolbar").hide();
  $("#nickInput").focus();
}

//transition the page to the loading screen
function showLoad () {
  $("#connect").hide();
  setStatusMessage('#loginform', 'Contacting server....', 'status');
  $("#toolbar").hide();
}

// transition page for connected, waiting for class to begin
function showWaiting(nick, channel) {
	$('#loginform').hide();
	$('#dialog').append('<div id="waiting" class="modalrow"><H2>Hello ' + nick + ' , Waiting for class session: ' 
	+ getChannel() + ' to begin ...</H2><br><p>When class begins, you will receive instructions \
	from your teacher on content to view.  Please standby.<br/></div>');
}

function checkSession(nick) {
	if (isClassInSession) {
		// alert('show chat');
		showMobileChat(nick);
	} else if (nick != "#") {
		showWaiting(nick, getChannel());
	} else {
		// alert('showLogin');
		showLogin(getChannel());
	}
}

function showMobileChat(nick) {
	$('#dialog').find('#waiting').remove();
	// $('#waiting').remove();
	$('.ui-dialog').dialog('close');
	$('#nickname').text(nick);
	// $(":input:text:visible:first").focus(); 
}

//transition the page to the main chat view, putting the cursor in the textfield
function showChat (nick) {
  $("#toolbar").show();
  // $(":input:text:visible:first").focus();
  $("#nickname").text(nick);
  if (teacher) { 
	$('#dialog').jqmHide();
  	scrollDown();
  }
}

// XXX Change this to show title updates properly
//we want to show a count of unread messages when the window does not have focus
function updateTitle(){
  if (CONFIG.unread) {
    document.title = "(" + CONFIG.unread.toString() + ") node chat";
  } else {
    document.title = "node chat";
  }
}

// daemon start time
var starttime;
// daemon memory usage
var rss;

//handle the server's response to our nickname and join request
function onConnect (session) {
  if (session.error) {
    alert("error connecting: " + session.error);
	setStatusMessage('#loginform', 'error connecting: ' + session.error, 'status')
    showConnect();
    return;
  }

  CONFIG.nick = session.nick;
  CONFIG.id   = session.id;
  starttime   = new Date(session.starttime);
  rss         = session.rss;
  isClassInSession = session.channelstate;
  updateRSS();
  updateUptime();

  //update the UI to show the chat
  if (teacher) {
	showMobileChat(CONFIG.nick);
  } else {
	// alert('is student');
	if (!isClassInSession) {
		showWaiting(CONFIG.nick, getChannel());
	} else {
		showMobileChat(CONFIG.nick);
	}
}
  /*
  if (!teacher) {
	setEpochCookie(CONFIG.id, starttime);
	checkSession(CONFIG.nick);
  } else {
	setEpochCookie(CONFIG.id, starttime); // Set the cookie
	if ($.mobile) {
		showMobileChat(CONFIG.nick);
	} else {
		$('#account').show()
		showChat(CONFIG.nick);
	}
  }
  */
  //listen for browser events so we know to update the document title
  $(window).bind("blur", function() {
    CONFIG.focus = false;
	// alert('lost focus');
    // updateTitle();
  });

  $(window).bind("focus", function() {
    CONFIG.focus = true;
    CONFIG.unread = 0;
	// alert('got focus');
    // updateTitle();
  });
}

//add a list of present chat members to the stream
function outputUsers () {
  var nick_string = nicks.length > 0 ? nicks.join(", ") : "(none)";
  addMessage("users:", nick_string, new Date(), "notice");
  return false;
}

//get a list of the users presently in the room, and add it to the stream
function who () {
  jQuery.get("/who", { channel: getChannel()}, function (data, status) {
    if (status != "success") return;
    nicks = data.nicks;
    outputUsers();
  }, "json");
}

function setStatusMessage(selector, message, id) {
	var statusMessage = 'Unspecified error';
	var statusID = 'status';
	if (message) statusMessage = message; 
	// alert(statusMessage);
	$(selector).find('span#' + id).addClass('error-message').text(statusMessage); // XXX We can make this more generic
}

function updateTeacherContent2(contentlist) {
	var contents = contentlist;
	var listitemdata = '';
	
	// XXX Probably should clear the existing items, in case this is a refresh
	$.each(contents, function(i, content) {
		var mime, fqname, filename, itemi, contentli, contentin, contentlab;
		itemi = 'item' + (i+1);
		fqname = contents[i].substring(contents[i].lastIndexOf('/') + 1); // XXX Escape me		
		mime = fqname.split('.')[1].toLowerCase();
		filename = fqname.split('.')[0];
		contentli = $('#ci-template').clone(); // Clone all the events!
		contentli.removeAttr('id', '#ci-template').find('span.ui-btn-text').html(filename + '- <em>['+ mime + ']</em>');
		contentli.find('.ui-btn').attr('for', itemi);
		contentli.find('.ui-btn-inner').attr('id', mime);
		contentli.find('.custom').attr('id', itemi).attr('name', itemi).attr('value', content);
		$('#resourceslist').append(contentli);
		// listitemdata += '<li class="' + mime + '" ><input type="checkbox" name="' + itemi + '" id="' + itemi + '" value="' + content + '" /><label for="'+ itemi +'">' + filename + '</label></li>';
		
		contentli.show();
	});
	$('#resourceslist input').checkboxradio();
	$('.ui-footer[data-position="fixed"]').fixHeaderFooter();
}
function launchShadowboxPreview(contenturl) {
	// alert('opening shadowbox to ' + contenturl);
	Shadowbox.open({
		title:      SHADOWBOX_CONFIG_TITLE,
		player: SHADOWBOX_CONFIG_PLAYER,
		content: contenturl,
		width: SHADOWBOX_CONFIG_WIDTH,
		height: SHADOWBOX_CONFIG_HEIGHT
	});
}

function messageDispatcher(cmd, data) {
	// MSGDEF - Teacher MCP UI
	switch(cmd) {
		case "msg":
			if (!util.isBlank(data)) send(data);
			break;
		case "sendurl": 
			if (!util.isBlank(data)) send(data);
			break;
		case "sendviewer":
			if (!util.isBlank(data)) sendviewer(data, cmd);
			break;
		case "endviewer":
			if (!util.isBlank(data)) sendviewer(data, cmd);
			break;
		case "preview":
			launchShadowboxPreview(data);
			break;
		case "sendviewerlocal":
			if (!util.isBlank(data)) sendviewer(data, cmd);
			break;
		case "sync":
			if (!util.isBlank(data)) sendmcprequest(data, cmd, 2); // XXX HARDCODED APDU
			break;
		case "mcpmodestart":
			// alert('mcpmodestart');
			sendmcprequest(data, cmd, 4); // XXX HARDCODED APDU
			break;
		case "mcpmodestop":
			// alert('mcpmodestop');
			sendmcprequest(data, cmd, 5); // XXX HARDCODED APDU
			break;
		case "launch":
			alert('TODO: implement launch handler');
			break;
		case "launchurl":
			if (!util.isBlank(data)) sendmcprequest(data, cmd, 1); // XXX HARDCODED APDU
			break;
		case "remoteinstall":
			alert('TODO: implement remoteinstall handler');
			break;
		case "killall":
			alert('TODO: implement killall handler');
			break;
		case "logoutall":
			alert('TODO: implement logoutall handler');
			break;
		default:
			alert('messageDispatch cannot handle outbound message type: ' + cmd);
	}
}

$(document).ready(function() {
  teacher = isTeacher();
  $('#account').hide(); // XXX Only for teacher?

  //submit new messages when the user hits enter if the message isnt blank
  $("#entry").keypress(function (e) {
    if (e.keyCode != 13 /* Return */) return;
    var msg = $("#entry").attr("value").replace("\n", "");
    if (!util.isBlank(msg)) send(msg);
    $("#entry").attr("value", ""); // clear the entry field.
  });

  if ($.mobile) {
	$("#csubmit").bind('tap', function() {
		// alert('tap event');
		var msg = $("#entry").attr("value").replace("\n", "");
	    if (!util.isBlank(msg)) send(msg);
	    $("#entry").attr("value", ""); // clear the entry field.
		return false;
	});
	$("#stopstartsubmit").bind('tap', function() {
		var msg;
		
		if (isClassInSession) {
			isClassInSession = false;
			msg = "startsession";
			// $('#sessionstate').html("<img src='/static/images/css/agt_action_fail.png' />");
			// addMessage("", "Class Session has ended!", new Date(), "error");
		} else {
			isClassInSession = true;
			msg = "startsession";
			// addMessage("", "Class Session has started.", new Date(), "error");
		}
		send(msg, msg);
		return false;
	});
  } else {
	$(".csubmit").click(function() {
		var msg = $("#entry").attr("value").replace("\n", "");
	    if (!util.isBlank(msg)) send(msg);
	    $("#entry").attr("value", ""); // clear the entry field.
		return false;
	  });
	}

  $(".qsubmit").click(function() {
	var msg = $("#entry").attr("value").replace("\n", "");
    if (!util.isBlank(msg)) send(msg, "askquestion");
    $("#entry").attr("value", ""); // clear the entry field.
	return false;
  });

  $(".asubmit").click(function() {
	// var msg = $("#answerform #entry").attr("value").replace("\n", "");
	var msg = "Q: " + $('#question').text() + " : A:" + $("#answerform #entry").attr("value").replace("\n", "");
	if (!util.isBlank(msg)) send(msg);
    $("#entry").attr("value", ""); // clear the entry field.
    $('#qadialog').jqmHide();
	return false;
  });

  $("#usersLink").click(outputUsers); // We won't implement this yet in the UI, but maybe for teacher XXX

  $(".logout").click(function() {
		logoutSession();
		return false;
  });

  $('#loginform').submit(function() {
		$(this).parents().find('span.error-message').removeClass('error-message').text('');
		var nick = $("#nickInput").attr("value");
	
		//dont bother the backend if we fail easy validations
	
		if (!nick || nick.length < 1) {
			setStatusMessage('#loginform', "Login name is required.", 'status');
		    return false;
		}
	
	    if (nick.length > 50) {
	      	// showConnect();
		  	// $('#dialog').jqm().show();
			setStatusMessage('#loginform', 'Login name is too long.  Must be less than 50 character.', 'status');
	      return false;
	    }
		//more validations
	    if (/[^\w_\-^!]/.exec(nick)) {
	      setStatusMessage('#loginform', "Bad character in nick. Can only have letters, numbers, and '_', '-', '^', '!'", 'status');
	      return false;
	    }

		//lock the UI while waiting for a response
	    showLoad();
		
		if ($.mobile) {
			// XXX This doesn't work :(
			/*
			$('#sendurl').attr('disabled', 'disabled');
			$('#sendviewer').attr('disabled', 'disabled');
			$('#endviewer').attr('disabled', 'disabled');
			$('#preview').attr('disabled', 'disabled');
			$('#sendlocal').attr('disabled', 'disabled');
			$('#sync').attr('disabled', 'disabled');
			*/

			
			$("#contentdelivery").change(function (e) { // XXX Make sure when this is fixed, fix it for #mcpcommands
				var cmd;
				var data;
				// XXX Should only allow one select, make sure this is the case on #contentdelivery
				// Oddly, the -1 also gets selected, which we don't want.  Use a more refined selector
				$("#contentdelivery option:selected").each(function () { 
					if ($(this).val() != '-1') {
						cmd = $(this).val();
					}
			    });
			    // alert('fired a ' + cmd);
				// There may be mulitple clicked contents
				$('#cpfieldset').find('input:checked').each( 
				    function(index) {
						data = this.value;
						// data.push(this.value);
						// alert('checked value is ' + data);
						
						// this.checked = false;
						// $(this).attr('checked') = false; // XXX This isn't working
				    } 
				);
				// XXX Handle multiple content selects
				messageDispatcher(cmd, data); // XXX These commands only work with content
		
				return false;
			});
			$("#mcpcommands").change(function (e) {
				var cmd;
				var data;
				// XXX Should only allow one select, make sure this is the case on #contentdelivery
				$("#mcpcommands option:selected").each(function() {
					// alert('selected ' + $(this).val());
					if ($(this).val() != '-1') {
						cmd = $(this).val();
					}
			    });
			    // alert('fired a ' + cmd);
				// There may be mulitple clicked contents
				// XXX Do we need this for MCP commands?
				$('#cpfieldset').find('input:checked').each( 
				    function(index) {
						data = this.value;
						// alert('checked value is ' + data);
						// this.checked = false;
						// $(this).attr('checked') = false; // XXX This isn't working
				    } 
				);
				messageDispatcher(cmd, data);
			});
			$('#sync').live('pageshow',function(event, ui){
				// Get the sync content list
				var $thispage = $(this);
				$.getJSON('http://localhost:' + MCP_RPC_PORT  + SYNC_FOLDER_ENDPOINT + '?jsoncallback=?',
				  { 
					channel: getChannel(),
				  },
				  function(data, textStatus) {
					if ((data.resultsCount) && (data.resultsCount > 0)) {
						var $ul = $("<ul>");
						$thispage.find("div[data-role=content] ul").detach();  // remove the existing ul
						$thispage.find("div[data-role=content]").append($ul);  // attach the new ul

						var contentlist = data.results;
						$ul.append('<li data-role="list-divider">Contents in folder for classroom: ' + getChannel() + '</li>');
						for (var i = 0; i < contentlist.length; i++) {
							var tmp = contentlist[i].split('/');
							var filename = tmp[tmp.length-1];
							// $ul.append('<li><a rel="external" href="javascript:void(0);" target="_blank" name="'+ contentlist[i] + '" class="syncurl">' + filename + '</a></li>');
							$ul.append('<li><a rel="external" href="' + contentlist[i] + '" target="_blank" name="'+ contentlist[i] + '" class="syncurl">' + filename + '</a></li>');
						}
						$ul.listview({
						       "inset": true
						});
						
						// XXX I think this will only work on android unless you change your CAPS file
						$(".syncurl").click(function(e) {
							var syncurl = $(this).attr('name');
							// alert('syncurl clicked ' + syncurl);
							openNewWindow(syncurl);
						});

					} // XXX Should give some feedback if no content available
				  });
			});
			$('#attendance').live('pageshow',function(event, ui){
				updateAttendanceSheet($(this));
			});
			$('#resources').live('pageshow',function(event, ui){
				// updateTeacherContent(roomcl);
			});
		} else {
			$("#sendurl").click(function (e) {
				$('#resources').find('input:checked').each( 
				    function(index) {
						var msg = this.value;
					    if (!util.isBlank(msg)) send(msg);
						this.checked = false;
				    } 
				);

				return false;
			});

			$("#sendviewer").click(function (e) {
				$('#resources').find('input:checked').each( 
				    function(index) {
						var msg = this.value;
						// alert('click sendviewer ' + msg);
					    if (!util.isBlank(msg)) sendviewer(msg, "sendviewer");
						this.checked = false;
				    } 
				);

				return false;
			});

			$("#endviewer").click(function (e) {
				var msg = "#endviewer";
				if (!util.isBlank(msg)) sendviewer(msg, "endviewer");
				return false;
			});

			$("#sendlocal").click(function (e) {
				$('#resources').find('input:checked').each( 
				    function(index) {
						var msg = this.value;
						// alert('click sendviewer local ' + msg);
					    if (!util.isBlank(msg)) sendviewer(msg, "sendviewerlocal");
						this.checked = false;
				    } 
				);

				return false;
			});
		}

		if ($.mobile) {
			$('#cpfieldset').find('input:checkbox').click(function() {
				var numchecked = $('input:checked').length;
				// alert(this.value + " clicked");
				if (numchecked < 1) {
					$('#contentdelivery').disabled='disabled';
				} else if (numchecked == 1) {
					$('#contentdelivery').find('#sendurl').removeAttr('disabled');
				} else {
				
				}
			});
		}
		
	    //make the actual join request to the server
	    $.ajax({ cache: false
	           , type: "GET" // XXX should be POST
	           , dataType: "json"
	           , url: "/join"
	           , data: { nick: nick, channel: getChannel() }
	           , error: function (xhr, text, err) {
					var errMsg =  eval("(" + xhr.responseText + ")");
				 	setStatusMessage('#loginform', "Error logging in, reason: Error Code " + xhr.status + " " + errMsg.error, 'status');
	             }
	           , success: onConnect
	           });
	    return false;
  });

 
  // update the daemon uptime every 10 seconds
  setInterval(function () {
    updateUptime();
  }, 10*1000);

  if (CONFIG.debug) {
    // $("#loading").hide();
    // $("#connect").hide();
    scrollDown();
    return;
  }

  // remove fixtures
  $(".msg").remove();
  $('.userscroll').find('li').remove();
  // $("#resources > li").remove();

  //begin listening for updates right away
  //interestingly, we don't need to join a room to get its updates
  //we just don't show the chat stream to the user until we create a session
  longPoll();

  showConnect();
});


//if we can, notify the server that we're going away.
/* $(window).unload(function () {
  setTimeout(partSession(), 60000);  // XXX Give the user a minute to return
}); */