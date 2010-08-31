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

function doPost(el1, el) {
  var ident = el1.attr('value');
  var isTeacher = false;
  if (path.indexOf('classmoderator') < 0)
	path = 'class';
  if (ident) $.cookie(cookieName, ident, { path: '/' + path });
  var text = el.attr('value');
  if (!text) 
	text = el.attr('href');
  if (!text) return;
  $.ajax({
    url: "/class/" + channel + "/post",
    data: { ident: ident, text: text },
    type: 'post',
    dataType: 'json',
    success: function(r) { }
  });
  el.attr('value', '');
  return;
}

function messageDbg(startsession, endsession, chat, runplayer, endplayer, reg, uncategorized, msg) {
	$('#dbg').text('ss: ' + startsession + ' es:' + endsession + ' ch:' + chat + ' rp:' + runplayer + ' ep:' + endplayer + ' rg:' + reg + ' uc:' + uncategorized + ' msg:' + msg);
}

var sURL = unescape(window.location.pathname);

function refresh() {
    window.location.href = sURL;
}

/* Depricate this XXX */
var longPoll = function() {
	// XXX Does this need a timeout value?  Maybe need to use $.ajax()?
	$.get('/class/<%= $channel %>/poll?client_id=' + Math.random(), {}, 
	 	function(data) {
			var events = data;
			// alert('looping on events: ' + JSON.stringify(events));
			for (var i = 0; i < events.length ; i++) {
				var newevent = events[i];
				// alert(newevent.time);
				onNewEvent(newevent);
			}
		}, 
		'json');
  }