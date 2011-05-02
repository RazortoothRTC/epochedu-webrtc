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
var BROWSERPLAYERWINDOW_OPTIONS = "location=no, scrollbar=yes,width=430,height=360,toolbar=yes";
var browserplayerwindow;
var platformplayer = false;
var MEM_CRITICAL_THRESHOLD = 400; // In MB
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
		// jQuery.get("/part", {id: CONFIG.id, channel: getChannel()}, function (data) { }, "json");
		$.ajax({
			url: "/part",
			data: {id: CONFIG.id, channel: getChannel()},
			dataType: "json",
			cache: false,
			success: function(data, textStatus, XMLHttpRequest){
			},
			complete: function complete(XMLHttpRequest, textStatus){
			},
			error: function(e) {
			},
		});
	} 
	CONFIG.id = null;  // XXX Needed to set status of user login
	CONFIG.nick ="#";
}

/* JQM Depricate */
function displayLogin() {
	var channel = getChannel();
	var usertype;
	if (isTeacher()) usertype = "Teacher's"; else usertype = "Student's";
	
	setStatusMessage('#loginform', ' ', 'status');
	$('#dialog').find('#waiting').remove();
	if ($.mobile) {
		$.mobile.changePage("loginpanel", "fade");
	}
	$('#loginform').show();
	$("#loginpanel").find("span#channel").html("<em>" + channel + "</em>");
	$("#loginpanel").find("span#usertype").html("<em>" + usertype + "</em>");
}

/* JQM Depricate */
function doLogout() {
	partSession();
	$('#account').hide();
	$('#nickname').text('');
	// $('#notificationTabInner').find('a.sessionstatus1').removeClass('sessionstatus1').addClass('sessionstatus2');
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
	$('.chatgui').hide(); // XXX Hide this so it doesn't bounce around ... for some reason it fights for focus
	if (isTeacher()) usertype = "Teacher's"; else usertype = "Student's";
	if ($.mobile) $.mobile.changePage("loginpanel", "slideup");
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

function updateUserStatus2(nick, timestamp) {
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

function updateUserStatus3(nick, timestamp) {
	if (teacher) {
		if (timestamp != -1) { // XXX Bug fix for devices with negative timestamp
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
	if (!$.mobile) {
		updateUserStatus3(nick, timestamp);
	} else {
  		updateUserStatus2(nick, timestamp);
	}
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
	var awindow;
	if (options) {
		awindow = window.open(url, "player", options);
	} else {
		awindow = window.open(url);
	}
	return awindow;
}

function openBestPlayer(url, selector, options) {
	var supportedextensions = ['jpg', 'png', 'gif', 'tif', 'html', 'htm', 'txt']; // DEMO CONF
	var fname = url.lastIndexOf('.');
	
	if (fname > -1) {
		fname = url.substring(fname + 1);
		if (supportedextensions.indexOf(fname) > -1) { /* If we can play in JS 'player' do it */
			if (fname != 'html' && fname != 'htm') {
				$.colorbox({href:url});
			} else {
				// $.colorbox({href:url, iframe: true});	
				launchShadowboxPreview(url);
			}
		} else {
			if (!teacher) {
				if (fname.indexOf('pdf') < -1) {
					openNewWindow(url); // Not using options for now
				} else {
					url = 'http://192.168.1.168:5000/content' + url.substring(url.indexOf('sdcard') + 6);
					mcpDispatcher3(eval("(" + mcpPayloadFactory(url, "launchurl", 1) + ")"), function(json) {
						platformplayer = true;
					}, function(d, msg) {
						addGrowlNotification('Error launching Sync Folder Content', 'Unable to launch content on local device using native player', '/static/images/status_unknown.png', '', false, 'mcpstatusgrowl');
					});
				}
			} else {
				openNewWindow(url); // Not using options for now
			}
		}
	}
}

function closeBrowserWindow(windowref) {
	if (windowref) {
		windowref.close(); // XXX Is there a better way to detect?
	}
	$.colorbox.close();
	Shadowbox.close();
	Shadowbox.clearCache();
}

function toggleNinjaButton(selector, isEnabled) {
	$(selector).children().each(
		function(index){
			if (isEnabled) {
				$(this).ninjaButtonEnable();
			} else {
				$(this).ninjaButtonDisable();
			}
		}
	);
}

// handles someone leaving
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
	if (!$.mobile) {
		updateUserStatus(nick, -1);
	} else {
  		updateUserStatus2(nick, -1);
	}
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
  // alert('scrollDown');
  window.scrollBy(0, 100000000000000000);
  $("#entry").focus();
}

//inserts an event into the stream for display
//the event may be a msg, join or part type
//from is the user, text is the body and time is the timestamp, defaulting to now
//_class is a css class to apply to the message, usefull for system events
function addMessage (from, text, time, _class) {
  // alert('addMessage');
  if (text === null) return;

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
  $pane = $('.chatscroll');
  var panepos = $pane.data('jScrollPanePosition');
  var maxpanepos = $pane.data('jScrollPaneMaxScroll');
  var autoScroll;
  if (panepos && maxpanepos && (panepos == maxpanepos)) {
		autoScroll = true;	
  }
  // addGrowlNotification('jScrollPaneDebug', 'jScrollPanePosition = ' + $pane.data('jScrollPanePosition') + ' jScrollPaneMaxScroll = ' + $pane.data('jScrollPaneMaxScroll'), '/static/images/wifi-red.png', '', false, 'debuggrowl');
  if (!$.mobile) {
	// alert('appending message');
	if ($.jScrollPane) {
  		$pane.append($('<div class="msg"><span class="user">' + util.toStaticHTML(from) + '</span><div class="eraser_500"><div class="msgcon"><p>' + text + '</p></div></div><div class="ts">' + util.timeString(time) + '</div>')).jScrollPane({scrollbarWidth:20, scrollbarMargin:10});
	} else {
		$pane.append($('<div class="msg"><span class="user">' + util.toStaticHTML(from) + '</span><div class="eraser_500"><div class="msgcon"><p>' + text + '</p></div></div><div class="ts">' + util.timeString(time) + '</div>'));
	}
	// XXX Remove for customer Cufon.refresh();
  } else {
	// alert('appending mobile message');
	
	$pane.append($('<div class="msg"><span class="user">' + util.toStaticHTML(from) + '</span><div class="msgcon">' + text + '</div><div class="ts">' + util.timeString(time) + '</div>'));
  } 
  // alert($pane.data('jScrollPaneMaxScroll') + " v " + $pane.data('jScrollPanePosition'));
  if (!autoScroll) {
	// alert('! autoscroll');
	if ($pane[0]) $pane[0].scrollTo($pane.data('jScrollPaneMaxScroll')); 
	} else {
		if ($pane[0]) $pane[0].scrollTo($pane.data('jScrollPaneMaxScroll'));
		// $pane[0].scrollTo($pane.data('jScrollPaneMaxScroll')-15); 
		// $pane[0].scrollTo($pane.data('jScrollPaneMaxScroll') + 30); 
	}
  if ($.Shadowbox) Shadowbox.setup(); // XXX Make sure I still need this
}

function mcpDispatcher3(mcpRequest, jcallback, ecallback) {
	var ticketid;
	
	var mcpResponse = {
	   apduresp: mcpRequest.ticketid,
	   sender: CONFIG.id,
	   status: 
	'<status code, negative for error conditions, 0 for success>',
	   timestamp: '<isoformat DATETIME>'
	};
	if (mcpRequest.apdu) {
		if (mcpRequest.apdu.constructor.name == 'Number') mcpRequest.apdu = eval('"' + mcpRequest.apdu + '"');
		// Perform any special handling
		// For now, all we do is dispatch
		// MSGDEF - Student MCP Dispatcher
		// alert('Student incoming MCP apdu ' + mcpRequest.apdu);
		switch(mcpRequest.apdu) {
			case "1":
				break;
			case "2":
				mcpRequest['syncnick'] = CONFIG.nick;
				addGrowlNotification('Successfully Dispatched Sync Request', 'Results of Content Sync Request will be updated as sync has completed.', '/static/images/birdy.png', '', false, 'mcpstatusgrowl');
				break;
			case "3":
				break;
			case "4":
				break;
			case "5":
				break;
			case "6":
				break;
			case "7":
				break;
			case "8":
				break;
			default:
				addGrowlNotification('MCPRequest Error', 'Received unknown MCPRequest  Detail: apdu = ' + mcpRequest.apdu, '/static/images/status_unknown.png', '', true, 'mcpstatusgrowl');
				return false;
		} 
		$.jsonp({
			"url": 'http://localhost:' + MCP_RPC_PORT  + MCP_RPC_ENDPOINT + '?jsoncallback=?',
			"data": mcpRequest,
			"success": jcallback,
			"error": ecallback,
		});
	} else {
		addGrowlNotification('MCPRequest Error', 'Received unknown MCPRequest  Detail: no readable apdu received.', '', true, 'mcpstatusgrowl');
	}
}

function getChannelsList(jcallback, ecallback) {
	$.ajax({ cache: false
	         , type: "GET"
	         , url: "/channels"
	         , dataType: "json"
	         , data: {}
			 , success: jcallback
			 , error: ecallback
	});
}

function updateRSS () {
  var bytes = parseInt(rss);
  if (bytes) {
    var megabytes = bytes / (1024*1024);
    megabytes = Math.round(megabytes*10)/10;
	if (teacher && (megabytes > MEM_CRITICAL_THRESHOLD)) {
		addGrowlNotification('Low Memory Warning', 'Memory on plug computer has surpassed critical threshold, currently at ' + megabytes + ' MB.  Please avoid syncing further content until current requests complete.', '/static/images/status_unknown.png', '', true, 'serverstatusgrowl');
	}
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
var first_invalid_session = true; // XXX Hack to deal with fact that first /recv after login will not know you've logged in yet

function longpollErrorHandler() {
	var retryDuration = transmission_errors * 10*1000;
	addMessage("", "long poll error. trying again... in " + (retryDuration/1000) + ' seconds', new Date(), "error");
	transmission_errors += 1;
	// addGrowlNotification('Server Error', 'Access to WiFi is interrupted or Server has Crashed.  Detail: long poll error. trying again... in ' + (retryDuration/1000) + ' seconds', '/static/images/wifi-red.png', '', false, 'wifistatusgrowl');
	//don't flood the servers on error, wait 10 seconds * number of transmission_errors before retrying 
	setTimeout(longPoll, retryDuration);
}

//process updates if we have any, request updates from the server,
// and call again with response. the last part is like recursion except the call
// is being made from the response handler, and not at some point during the
// function's execution.
function longPoll (data) {
  if (transmission_errors > LONG_POLL_ERROR_MAX_RETRY) { // XXX Make this more robust and reconnect opportunistically
    addMessage("", "Too many long poll errors, exceeded " + LONG_POLL_ERROR_MAX_RETRY + ', logout', new Date(), "error");
	addGrowlNotification('Server Error', 'Access to WiFi is interrupted or Server has Crashed.  Detail: Too many long poll errors, exceeded ' + LONG_POLL_ERROR_MAX_RETRY + ' , logout', '/static/images/wifi-red.png', '', true, 'wifistatusgrowl');
	setTimeout(logoutSession, 5000); // If we fail to reconnect, show message and then go to login
	return;
  }
  
  if (data && (data.state < 0) && (CONFIG.id != null)) { // XXX Bug here trying to test if session is invalid
	if (first_invalid_session) {
		first_invalid_session = false;
	} else {
		addGrowlNotification('Session Invalid', "Session is invalid, you won't be able to send messages but you can observe...probably server restarted, please reload the page to restore your session.", '/static/images/status_unknown.png', '', false, 'sessionstatusgrowl');
	}
	// invalidateEpochCookie();
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
		  // alert('addMsg = ' + message.text);
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
		case "universalsend":
			if (!first_poll) {
				var contenturl = message.text;
				if (!teacher) {
					// First Try to ping the MCP
					mcpDispatcher3(eval("(" + mcpPayloadFactory(contenturl, "pingheartbeat", 7) + ")"), function(json) {
						var mcpResp;
						
						if (json) {
							mcpResp = json;
						} 
						
						// XXX Should report back some status here
						if (mcpResp && mcpResp.status == '0') { 
							// alert('Got mcpResponse status = ' + mcpResp.status);
							// Then check if content is synced
							// If it is run local
							// If it is not, do a view
							// alert('universalsend - running android.View of url ' + contenturl);
							mcpDispatcher3(eval("(" + mcpPayloadFactory(contenturl, "launchurl", 1) + ")"), function(json) {
								if (!json || json.status != 0) {
									browserplayerwindow = openBestPlayer(message.text);
								} else {
									// Success
									addGrowlNotification('Launched Native Player', 'Launched a Native Platform Player for content' + message.text, '/static/images/birdy.png', '', false, 'mcpstatusgrowl');
	
									platformplayer = true;
								}
							}, function(d, msg) {
								// XXX Hide this for now addGrowlNotification('Error launching Content', 'Unable to launch content on local device using native player- pop open a new window', '/static/images/status_unknown.png', '', false, 'mcpstatusgrowl');
								browserplayerwindow = openBestPlayer(message.text);
							});
						} else { // XXX Why would this ever happen ?
							// Just open it in the browser
							addGrowlNotification('Error launching Content', 'Ping heartbeat returned improper resonse - pop open a new window', '/static/images/status_unknown.png', '', false, 'mcpstatusgrowl');
							browserplayerwindow = openBestPlayer(message.text);
						}
					}, function(d,msg) {
						    // alert("MCP Service is not running, please notify your teacher");
							// Just open it in the browser
							addGrowlNotification('Error launching Content', 'No ping heartbeat receivedMCP Service is not running, please notify teacher - could not reach MCP universalsend - pop open a new window', '/static/images/status_unknown.png', '', false, 'mcpstatusgrowl');
							browserplayerwindow = openBestPlayer(message.text);
					});
					
				} else {
					// Just open it in the browser
					browserplayerwindow = openBestPlayer(message.text);
				}
			}
			break;		
		case "endviewer":
		 	// alert('ended a viewer');
			// browserplayerwindow
			// platformplayer
			if (!first_poll) {
				// If there is a browserplayerwindow open, close it
				addGrowlNotification('Ending Content Player', 'Request made to end the currently running Content Player.', '/static/images/birdy.png', '', false, 'mcpstatusgrowl');
				var contenturl = message.text; // XXX This can be anything really
				if (true) { // XXX For now, always try to kill the browser player
					// alert('browserplayer is true');
					closeBrowserWindow(browserplayerwindow);
					browserplayerwindow = undefined;
				}

				if (!teacher) { // XXX For now, always try to kill the local player
					// Then Try to ping the MCP
					mcpDispatcher3(eval("(" + mcpPayloadFactory(contenturl, "pingheartbeat", 7) + ")"), function(json) {
						var mcpResp;
					
						if (json) {
							mcpResp = json;
						} 
						// XXX Should report back some status here
						// alert('Got mcpResponse status = ' + mcpResp.status);
						if (mcpResp && mcpResp.status == '0') { 
							// alert('calling killplatformplayer');
							// alert('Got mcpResponse status = ' + mcpResp.status);
							// If there is a platformplayer running, kill it
							
							// XXX This sucks ... only here to deal with Android media player deficiencies
							mcpDispatcher3(eval("(" + mcpPayloadFactory(contenturl, "killplatformplayer", 8) + ")"), function(json) {
								if (json && json.status == 0) {
									// alert('successful call to killplatformplayer');
									platformplayer = false;
								}
							}, function(d, msg) {
								addGrowlNotification('Error ending Content Player', 'Unable to end native Content player on device.  You will need to close the player manually.  Notify teacher.', '/static/images/status_unknown.png', '', false, 'mcpstatusgrowl');
							});		
						} else { // XXX Why would this ever happen ?
							addGrowlNotification('Error ending Content Player', 'Ping heartbeat returned improper resonse - You will need to close the player manually.  Notify teacher.', '/static/images/status_unknown.png', '', false, 'mcpstatusgrowl');
						}
					}, function(d,msg) {
						    addGrowlNotification('Error ending Content Player', 'Unable to send a ping heartbeat.  You will need to close the player manually.  Notify teacher: No MCP Service is reachable.', '/static/images/status_unknown.png', '', false, 'mcpstatusgrowl');
					});
				} /* else {
					addGrowlNotification('No Running Player Detected', 'Could not detect a Native Platform Content Player.  If it is still running, please close it manually.', '/static/images/birdy.png', '', false, 'mcpstatusgrowl');
				} */
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
			addGrowlNotification('Class Session Started', 'Class: ' + getChannel() + ' has started', '/static/images/birdy.png', '', false);
			isClassInSession = true;
			if (!teacher) {
				if (isUserInSession()) {
					if (!$.mobile) {
						// $('#dialog').jqmHide();
						// $('#waiting').text("");
						showChat();
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
				// addMessage("", "Class Session has started", new Date(), "error");
			}
			break;
		
		case "endsession":
		 	// alert('ended a class');
			addGrowlNotification('Class Session Ended', 'Class: ' + getChannel() + ' has ended', '/static/images/birdy.png', '', false);
			isClassInSession = false;
			if (!teacher) {
				$('.chatscroll').children().remove();
				if (isUserInSession()) {
					if ($.mobile) { 
						$.mobile.changePage("loginpanel", "slideup");
						showWaiting(CONFIG.nick, getChannel());
					} else {	
						$('#dialog').jqmShow();
						showWaiting(CONFIG.nick, getChannel());
					}
				}
			} else {
				$('.chatscroll').children().remove();
				// addMessage("", "Class Session has ended!", new Date(), "error");
			}
			
			break;
		
		case "mcprequest":
			
			if (!teacher) {
				// alert('mcprequest');
				mcpDispatcher3(message.payload, function(json, textStatus) {
					if (json.status == '0') {
						// alert('received some data from MCP' + eval('"' + json + '"'));
						mcpResponse = json;
					} else {
						addGrowlNotification('MCP Response', 'Received response: ' + json.status, '/static/images/birdy.png', '', false, 'mcpstatusgrowl');
					}
					// alert('Got mcpResponse status = ' + mcpResponse.status + ' send response back to teacher');
					// XXX Should report back some status here
				  }, function(d,msg) {
					addGrowlNotification('Error sending MCPRequest', 'Error sending MCPRequest - MCP Service not running or unreachable.  Please notify teacher.', '/static/images/status_unknown.png', '', false, 'mcpstatusgrowl');
				});
			}
			break;
		case "syncack":
			if (teacher){
				addGrowlNotification('Sync Completed', message.text, '/static/images/birdy.png', '', false, 'mcpstatusgrowl');
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
			addGrowlNotification('Unknown mesage type received: ' + message.type, 'Error 500:  No way to process this incoming message.  Notify your systems administrator.', '/static/images/status_unknown.png', '', true, 'msgstatusgrowl');
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
         , error: longpollErrorHandler
         , success: function (data) {
			if(!data){
			           longpollErrorHandler();
			} else {
		             transmission_errors = 0;

		             //if everything went well, begin another request immediately
		             //the server will take a long time to respond
		             //how long? well, it will wait until there is another message
		             //and then it will return it to us and close the connection.
		             //since the connection is closed when we get data, we longPoll again
		             longPoll(data);
			}
           }
         });
}

//submit a new message to the server
function send(msg, type) {
  if (CONFIG.debug === false) {
	$.ajax({
		url: "/send",
		data: {id: CONFIG.id, text: msg, type: type, channel: getChannel()},
		dataType: "text",
		cache: false,
		success: function(data, textStatus, XMLHttpRequest){
			// addGrowlNotification('/send AJAX done', 'Send msg type '  + type, '/static/images/white/gear.png', '', false, 'debuggrowl');
		},
		complete: function complete(XMLHttpRequest, textStatus){
			// alert('/send done');
		},
		error: function(e) {
			addGrowlNotification('Session Invalid', "Session is invalid, you won't be able to send messages but you can observe...probably server restarted or you left the session when your browser went off to a new page, please reload the page to restore your session.", '/static/images/status_unknown.png', '', false, 'sessionstatusgrowl');			
		},
	});
  }
}

function handleError(myReqObj,textStatus,errorThrown) {
	alert("Error: "+myReqObj.number
		+"\nType: "+textStatus.name
		+"\nSource Object Id: "+myReqObj.id
	);
}

//push a viewer out to clients XXX This is identical to send :(  .... Get rid of this
function sendviewer(msg, type) {
  send(msg, type);
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
			// alert('sending payload' + payload);
			// XXX should be POST
			// XXX transmitting via send may not be the right idea ... or, don't put any data into text other than chat 
	    	payload = mcpPayloadFactory(msg, type, apdu);
			// XXX We don't do anything with the response!!!
			if (payload) {
				jQuery.get("/send", {id: CONFIG.id, text: msg, type: 'mcprequest', channel: getChannel(), payload: eval("(" + payload + ")")}, function (data) { }, "json");
			} else {
				alert('paylod is empty');
			}
		}
	}
}

function mcpPayloadFactory(msg, type, apdu) {
	var payload;
	var mcpdata = msg;
	if (!mcpdata) mcpdata = [];
	payload = '{ apdu: ' + apdu + ', to: "*", requestoruri: "' + CONFIG.nick + '@' + CONFIG.id + '", ticketid: "<unique ticket ID>", ' + type + ': "' + mcpdata + '"}';
	// alert('mcpPayloadFactory = ' + payload); 
	return payload;
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
	$('#gohome').ninjaButtonCreate({
	  icon:'home', 
	  onSelect:function(){ 
		$(this).ninjaButtonDeselect();
	  },
	  title:'Home' 
	});
	$("#gohome").live("click", function(e) { 
		window.location = '/teacher';
	});
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
  $('#account').show();
  $("#entry").focus();
  $('.chatgui').show();
  // $(":input:text:visible:first").focus();
  $("#nickname").text(nick);
  // if (teacher) { 
	$('#dialog').jqmHide();
  	scrollDown();
  // }
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
	addGrowlNotification('error connecting', "error connecting: " + session.error, '/static/images/status_unknown.png', '', false, 'serverstatusgrowl');
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

  if (session.channelstate == 1) { 
	isClassInSession = true;
	if (teacher) { 
		// $('.start').trigger('click');
		$('#startsessionbtn').trigger('click');
	}
  } else {
	isClassInSession = false;
  }

  

  //update the UI to show the chat
  if (teacher) {
	if (!$.mobile) {
		showChat(CONFIG.nick);
	} else {
		showMobileChat(CONFIG.nick);
	}
  } else {
	// alert('is student');
	if (!isClassInSession) {
		showWaiting(CONFIG.nick, getChannel());
	} else {
		if (!$.mobile) {
			showChat(CONFIG.nick);
		} else {
			showMobileChat(CONFIG.nick);
		}
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

function addGrowlNotification(title, text, imagepath, time, sticky, classname) {
	if (!classname) classname = 'epochgrowl';
	var unique_id = $.gritter.add({
		// (string | mandatory) the heading of the notification
		title: title,
		// (string | mandatory) the text inside the notification
		text: text,		// (string | optional) the image to display on the left
		image: imagepath,
		// (bool | optional) if you want it to fade out on its own or just sit there
		sticky: sticky, 
		// (int | optional) the time you want it to be alive for before fading out
		time: time,
		// (string | optional) the class name you want to apply to that specific message
		class_name: classname,
	});
	return false;
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
			addGrowlNotification('Sync Request Sent', 'Sent Sync request for URL: ' + data + '.  Results of Content Sync Request will be updated as sync has completed.', '/static/images/birdy.png', '', false, 'mcpstatusgrowl');
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

function bindstopstart() {
	$(".start").live('click', function() {
	    var msg = "#startsession";
	    if (!util.isBlank(msg)) send(msg, 'startsession');
	    return false;
	});

	$(".stop").live('click', function() {
	    var msg = "#endsession";
	    if (!util.isBlank(msg)) send(msg, 'endsession');
	    return false;
	});
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

  if ($.mobile) { // JQM
	$("#csubmit").bind('tap', function() {
		// alert('tap event');
		var msg = $("#entry").attr("value").replace("\n", "");
	    if (!util.isBlank(msg)) send(msg);
	    $("#entry").attr("value", ""); // clear the entry field.
		return false;
	});
	$("#stopstartsubmit").live('tap', function() {
		var msg;
		
		if (isClassInSession) {
			isClassInSession = false;
			msg = "#endsession";
			// $("#entry").attr("value", msg);
			// $('#sessionstate').html("<img src='/static/images/css/agt_action_fail.png' />");
			
			send(msg, "endsession");
			// addMessage("", "Class Session has ended!", new Date(), "error");
		} else {
			isClassInSession = true;
			msg = "#startsession";
			// $('#sessionstate').html("<img src='/static/images/css/agt_runit.png' />");
			// addMessage("", "Class Session has started.", new Date(), "error");
			send(msg, "startsession");
		}
		
		
		return false;
	});
  } else { // JQUERY
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

  	$("#usersLink").click(outputUsers); // Only for teacher UI
	$("#connectButton").click(function () {
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

	bindstopstart();

    $('#resources > input[type="checkbox"]').click(function (e) {
		alert('clicked on checkbox');
 	});

	$('#resources > li').click(function(e) {
		var $cb = $(this).children('input[type="checkbox"]');
		if ($cb.attr('checked')) {
			$cb.removeAttr('checked')
		} else {
			$cb.attr('checked', true);
		}
		if ($cb.attr('checked')) {
			$('#mediacontrol').children().each(
				function(index){
					$(this).ninjaButtonEnable();
				}
			);
		} else {
			$('#mediacontrol').children().each(
				function(index){
					$(this).ninjaButtonDisable();
				}
			);
		}
		return false;
	});


	$("#sendurl").click(function(e) {
	    $('#resources').find('input:checked').each(
	    	function(index) {
		        var msg = this.value;
		        if (!util.isBlank(msg)) send(msg, "sendurl");
		        this.checked = false;
		    }
	    );
	    return false;
	});
	/* XXX DEPRICATED, NOW LIVES IN HTML TEMPLATE */
	$("#sendviewer").click(function(e) {
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

	/* XXX DEPRICATED, NOW LIVES IN HTML TEMPLATE */
	$("#endviewer").click(function(e) {
	    var msg = "#endviewer";
	    if (!util.isBlank(msg)) sendviewer(msg, "endviewer");
	    return false;
	});

	/* XXX DEPRICATED, NOW LIVES IN HTML TEMPLATE */
	$("#sendlocal").click(function(e) {
	    $('#resources').find('input:checked').each(
	    function(index) {
	        var msg = this.value;
	        if (!util.isBlank(msg)) sendviewer(msg, "sendviewerlocal");
	        this.checked = false;
	    }
	    );

	    return false;
	});

	/* XXX DEPRICATED, NOW LIVES IN HTML TEMPLATE */
	/*
	$("#sync").click(function(e) {
	    $('#resources').find('input:checked').each(
	    function(index) {
	        var msg = this.value;
	        // alert('click sync ' + msg);
	        messageDispatcher("sync", msg);
	        this.checked = false;
	    }
	    );
	    return false;
	}); */ 
	//make the actual join request to the server
	$.ajax({
	    cache: false
	    ,
	    type: "GET"
	    // XXX should be POST
	    ,
	    dataType: "json"
	    ,
	    url: "/join"
	    ,
	    data: {
	        nick: nick,
	        channel: getChannel()
	    }
	    ,
	    error: function(xhr, text, err) {
	        var errMsg = eval("(" + xhr.responseText + ")");
	        setStatusMessage('#loginform', "Error logging in, reason: Error Code " + xhr.status + " " + errMsg.error, 'status');
	    }
	    ,
	    success: onConnect
	});
	return false;
	});

  $(".logout").click(function() {
		logoutSession();
		return false;
  });

  $('.chatgui').hide(); // XXX Hide this so it doesn't bounce around ... for some reason it fights for focus

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
							openBestPlayer(syncurl);
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
  /* 
  setInterval(function() {
		// Check if longPoll has died, restart if it has
		var timenow = (new Date()).getTime();
		var diff = timenow - CONFIG.last_message_time;

		if (CONFIG.id && (diff > 30000)) {
			addGrowlNotification('Server Error', 'Long Poll errror.  Detail: Long poll connection broken while launching content. ', '/static/images/wifi-red.png', '', true, 'wifistatusgrowl');
		}
	}, 30000); */

  showConnect();
});


//if we can, notify the server that we're going away.
$(window).unload(function () {
	partSession();
	// setTimeout(partSession(), 60000);  // XXX Give the user a minute to return
});