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
var isInSession = false;
var EPOCH_COOKIE = "epochedu_cookie";
var COOKIE_TIMEOUT_IN_MILLIS = 60 * 60 * 1000; // 1 hour 
var VERIFY_SESSION_INTERVAL_IN_MILLIS = 30000; // 1 hour 
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

function isLoggedIn() {
	var sessionid = isEpochCookieSet();
	var nick = CONFIG.nick;
	if (!sessionid) {
		return undefined;
	} else {
		return sessionid;
	}
}

function partSession() {
	if (CONFIG.id) {
		jQuery.get("/part", {id: CONFIG.id, channel: getChannel()}, function (data) { }, "json");
	} 
}

function logoutSession() {
	invalidateEpochCookie();
	partSession();
	showLogin();
}
function showLogin(channel) {
	var usertype;
	setStatusMessage('#loginform', ' ', 'status');
	$('#waiting').remove();
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
					addMessage("", "Session is invalid, you won't be able to send messages but you can observe...probably server restarted, please cmd://refresh", new Date(), "error");
					// alert('Session is not alive: ');
	             }
	           , success: function(data) {	 		 
			 	 } 
	           });
	return; 
}

function verifyEpochCookie(sessionid) {
	var nick;
	$.ajax({ cache: false
	           , type: "GET" // XXX should be POST
	           , dataType: "json"
	           , url: "/rejoin"
	           , data: { id: sessionid, channel: getChannel() }
	           , error: function (xhr, text, err) {
					invalidateEpochCookie(sessionid);
					showLogin(getChannel());
	             }
	           , success: onConnect
	           });
	if (nick) return nick;
	return undefined; 
}

function setEpochCookie(sessionid, startdate) {
	$.cookie(EPOCH_COOKIE, sessionid, { path: '/class', expires: dateInFutureMilliseconds(startdate, COOKIE_TIMEOUT_IN_MILLIS) }); // XXX We may want to make the path configurable as an arg
}

//updates the users link to reflect the number of active users
function updateUsersLink ( ) {
  var t = nicks.length.toString() + " student";
  if (nicks.length != 1) t += "s";
  $("#usersLink").text(t);
}

function updateUserStatus(nick, timestamp) {
	if (teacher) {
		if (timestamp > 0) {
			if ($('#userstatus > li').length > 0) {
				if ($('li#' + nick).length > 0) {
					// alert('found a match, do not insert'); 
					// XXX No op is dumb, fix this later
				} else {
					$('#userstatus').append('<li id="' + nick + '"class="online">' + nick +'</li>');
				}
			} else {
				$('#userstatus').append('<li id="' + nick + '"class="online">' + nick +'</li>');
			}
		} else {
			$('li#' + nick).remove();
		}
	}
}

function isUserInSession() {
	for (var i = 0; i < nicks.length; i++) // XXX Put this data into a DB so lookup is quick
	    if (nicks[i] == nick) return true;
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
  updateUserStatus(nick, timestamp);
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
  if (transmission_errors > 2) { // XXX Make this more robust and reconnect opportunistically
    showConnect();
    return;
  }
  
  if (data && (data.state < 0)) {
		invalidateEpochCookie();
		if (CONFIG.id) addMessage("", "Session is invalid, you won't be able to send messages but you can observe...probably server restarted, please cmd://refresh", new Date(), "error");
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
				if (!teacher) window.open(contenturl);
			}
			break;
			
		case "startsession":
			// alert('started a class');
			isInSession = true;
			if (!teacher) {
				if (CONFIG.id) {
					if (document.jqm) {
						$('#dialog').jqmHide();
						$('#waiting').text("");
					} else { // XXX We need to do better than this and know what our UI is
						// $('#loginpanel').
						$('.ui-dialog').dialog('close'); 
						$('#waiting').text("");
					}
				}
			}
			break;
		
		case "endsession":
		 	// alert('ended a class');
			isInSession = false;
			if (!teacher) {
				if ($.mobile) { 
					$.mobile.changePage("loginpanel", "slideup");
					showWaiting(CONFIG.nick);
				} else {	
					$('#dialog').jqmShow();
				}
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
             addMessage("", "long poll error. trying again...", new Date(), "error");
             transmission_errors += 1;
             //don't flood the servers on error, wait 10 seconds * number of transmission_errors before retrying 
             setTimeout(longPoll, transmission_errors * 10*1000);
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
  if (CONFIG.debug === false) {
    // XXX should be POST
    // XXX should add to messages immediately
    jQuery.get("/send", {id: CONFIG.id, text: msg, type: type, channel: getChannel()}, function (data) { }, "json");
  }
}

//push a viewer out to clients
function sendviewer(msg, type) {
  if (CONFIG.debug === false) {
    // XXX should be POST
    // XXX should add to messages immediately
    jQuery.get("/send", {id: CONFIG.id, text: msg, type: type, channel: getChannel()}, function (data) { }, "json");
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
	from your teacher on content to view.  Please standby.<br/>');
}

function checkSession(nick) {
	if (isInSession) {
		showMobileChat(nick);
	} else if (nick != "#") {
		showWaiting(nick);
	} else {
		showLogin();
	}
}

function showMobileChat(nick) {
	$('.ui-dialog').dialog('close');
	$(":input:text:visible:first").focus(); 
}

//transition the page to the main chat view, putting the cursor in the textfield
function showChat (nick) {
  $("#toolbar").show();
  $(":input:text:visible:first").focus();
  $("#nick").text(nick);
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
  updateRSS();
  updateUptime();

  //update the UI to show the chat
  if (!teacher) {
	setEpochCookie(CONFIG.id, starttime); // Set the cookie
	checkSession(CONFIG.nick);
  } else {
	if ($.mobile) {
		showMobileChat(CONFIG.nick);
	} else {
		$('#account').show()
		showChat(CONFIG.nick);
	}
  }
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

function updateTeacherContent(contentlist) {
	var contents = contentlist;
	var listitemdata = '';
	
	$.each(contents, function(i, content) {
		var mime, fqname, filename, itemi, contentli, contentin, contentlab;
		itemi = 'item' + (i+1);
		fqname = contents[i].substring(contents[i].lastIndexOf('/') + 1); // XXX Escape me		
		mime = fqname.split('.')[1].toLowerCase();
		filename = fqname.split('.')[0];
		contentli = $('#ci-template').clone(); // Clone all the events!
		contentli.removeAttr('id', '#ci-template').find('span.ui-btn-text').text(filename);
		contentli.find('.ui-btn').attr('for', itemi);
		contentli.find('.custom').attr('id', itemi).attr('name', itemi);
		$('#resourceslist').append(contentli);
		contentli.show();
	});
	$('#resourceslist input').checkboxradio();
	
	/*
	$.each(contents, function(i, content) {
		var mime, fqname, filename, itemi, contentli, contentin, contentlab;

		itemi = 'item' + (i+1);
		fqname = contents[i].substring(contents[i].lastIndexOf('/') + 1); // XXX Escape me		
		mime = fqname.split('.')[1].toLowerCase();
		filename = fqname.split('.')[0];	
		// listitemdata += '<li class="' + mime + '" ><input type="checkbox" name="' + itemi + '" id="' + itemi + '" value="' + content + '" /><label for="'+ itemi +'">' + filename + '</label></li>';
		listitemdata += '<input type="checkbox" class="custom" id="checkbox-' + itemi + '" name="checkbox-' + itemi + '"><label for="checkbox-1a" data-theme="c" class="ui-btn ui-btn-icon-left ui-corner-top ui-btn-up-c">' + filename +'</label>';
	});
	$('#resourceslist').append(listitemdata);
	$('#resourceslist input').checkboxradio();
	*/
	/*
	$.each(contents, function(i, content) {
		var mime, fqname, filename, itemi, contentli, contentin, contentlab;

		itemi = 'item' + (i+1);
		fqname = contents[i].substring(contents[i].lastIndexOf('/') + 1); // XXX Escape me		
		mime = fqname.split('.')[1].toLowerCase();
		filename = fqname.split('.')[0];	
		// listitemdata += '<li class="' + mime + '" ><input type="checkbox" name="' + itemi + '" id="' + itemi + '" value="' + content + '" /><label for="'+ itemi +'">' + filename + '</label></li>';
		listitemdata += '<input type="checkbox" class="custom" id="checkbox-' + itemi + '" name="checkbox-' + itemi + '"><label for="checkbox-1a" data-theme="c" class="ui-btn ui-btn-icon-left ui-corner-top ui-btn-up-c">' + filename +'</label>';
	});
	$('#resourceslist').append(listitemdata);
	$('#resourceslist input').checkboxradio();
	*/
	/*
	$.each(contents, function(i, content) {
		var mime, fqname, filename, itemi, contentli, contentin, contentlab;
		itemi = 'item' + (i+1);
		fqname = contents[i].substring(contents[i].lastIndexOf('/') + 1); // XXX Escape me		
		mime = fqname.split('.')[1].toLowerCase();
		filename = fqname.split('.')[0];
		contentli = $('#ci-template').clone(); // Clone all the events!
		contentli.removeAttr('id', '#ci-template').find('span.ui-btn-text').text(filename);
		contentli.find('.ui-btn').attr('for', itemi);
		contentli.find('.custom').attr('id', itemi).attr('name', itemi);
		$('#resourceslist').append(contentli);
		contentli.show();
	});
	$('#resourceslist input').checkboxradio();
	*/
	/*
	$.each(contents, function(i, content) {
		var mime, fqname, filename, itemi, contentli, contentin, contentlab;

		itemi = 'item' + (i+1);
		fqname = contents[i].substring(contents[i].lastIndexOf('/') + 1); // XXX Escape me		
		mime = fqname.split('.')[1].toLowerCase();
		filename = fqname.split('.')[0];	
		// listitemdata += '<li class="' + mime + '" ><input type="checkbox" name="' + itemi + '" id="' + itemi + '" value="' + content + '" /><label for="'+ itemi +'">' + filename + '</label></li>';
		listitemdata += '<div class="ui-checkbox"><input type="checkbox" class="custom" id="checkbox-' + itemi + '" name="checkbox-' + itemi + '"><label for="checkbox-1a" data-theme="c" class="ui-btn ui-btn-icon-left ui-corner-top ui-btn-up-c">' + filename +'</label></div>';
	});
	$('#resourceslist').append(listitemdata);
	$('#resourceslist input').checkboxradio();
	$('#resources').page();
	*/
	/*
	$.each(contents, function(i, content) {
		var mime, fqname, filename, itemi, contentli, contentin, contentlab;
		itemi = 'item' + (i+1);
		fqname = contents[i].substring(contents[i].lastIndexOf('/') + 1); // XXX Escape me		
		mime = fqname.split('.')[1].toLowerCase();
		filename = fqname.split('.')[0];
		contentli = $('#ci-template').clone(); // Clone all the events!
		contentli.removeAttr('id', '#ci-template').find('span.ui-btn-text').text(filename);
		contentli.find('.ui-btn').attr('for', itemi);
		contentli.find('.custom').attr('id', itemi).attr('name', itemi);
		$('#resourceslist').append(contentli);
		contentli.show();
	});
	$('#resourceslist input').checkboxradio();
	$('#resources').page();
	*/
	/*
	$.each(contents, function(i, content) {
		var mime, fqname, filename, itemi, contentli, contentin, contentlab;
		itemi = 'item' + (i+1);
		fqname = contents[i].substring(contents[i].lastIndexOf('/') + 1); // XXX Escape me		
		mime = fqname.split('.')[1].toLowerCase();
		filename = fqname.split('.')[0];
		contentli = $('#ci-template').clone(); // Clone all the events!
		contentli.removeAttr('id', '#ci-template').find('span.ui-btn-text').text(filename);
		contentli.find('.ui-btn').attr('for', itemi);
		contentli.find('.custom').attr('id', itemi).attr('name', itemi);
		$('#resourceslist').append(contentli);
		contentli.show();
		contentli.checkboxradio('refresh');
	});
	*/
	
	/* $.each(contents, function(i, content) {
		var mime, fqname, filename, itemi, contentli, contentin, contentlab;
		itemi = 'item' + (i+1);
		fqname = contents[i].substring(contents[i].lastIndexOf('/') + 1); // XXX Escape me		
		mime = fqname.split('.')[1].toLowerCase();
		filename = fqname.split('.')[0];
		contentli = $("ci-template").clone();
		contentli.remove('#ci-template').find('#checkbox-1a').remove('#checkbox-1a').add('id', itemi);
		$('#resourceslist').append(contentli);
		contentli.show();
	});		
	*/
		// <div class="ui-checkbox" id="ci-template"><input type="checkbox" class="custom" id="checkbox-1a" name="checkbox-1a"><label for="checkbox-1a" data-theme="c" class="ui-btn ui-btn-icon-left ui-corner-top ui-btn-up-c">Spanish Lesson 01</label></div>
	
	/* $.each(contents, function(i, content) {
		var mime, fqname, filename, itemi, contentli, contentin, contentlab;

		itemi = 'item' + (i+1);
		fqname = contents[i].substring(contents[i].lastIndexOf('/') + 1); // XXX Escape me		
		mime = fqname.split('.')[1].toLowerCase();
		filename = fqname.split('.')[0];	
		// listitemdata += '<li class="' + mime + '" ><input type="checkbox" name="' + itemi + '" id="' + itemi + '" value="' + content + '" /><label for="'+ itemi +'">' + filename + '</label></li>';
		listitemdata += '<div class="ui-checkbox"><input type="checkbox" class="custom" id="checkbox-' + itemi + '" name="checkbox-' + itemi + '"><label for="checkbox-1a" data-theme="c" class="ui-btn ui-btn-icon-left ui-corner-top ui-btn-up-c">' + filename +'</label></div>';
	});
	$('#resourceslist').append(listitemdata);
	*/
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

		$(".start").click(function () {
			var msg = "#startsession";
		    if (!util.isBlank(msg)) send(msg);
			return false;
		});
	
		$(".stop").click(function () {
			var msg = "#endsession";
		    if (!util.isBlank(msg)) send(msg);
			return false;
		});
	
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
$(window).unload(function () {
  partSession();
});

$.fn.listHandlers = function(events, outputFunction) {
    return this.each(function(i){
        var elem = this,
            dEvents = $(this).data('events');
        if (!dEvents) {return;}
        $.each(dEvents, function(name, handler){
            if((new RegExp('^(' + (events === '*' ? '.+' : events.replace(',','|').replace(/^on/i,'')) + ')$' ,'i')).test(name)) {
               $.each(handler, function(i,handler){
                   outputFunction(elem, '\n' + i + ': [' + name + '] : ' + handler );
               });
           }
        });
    });
};