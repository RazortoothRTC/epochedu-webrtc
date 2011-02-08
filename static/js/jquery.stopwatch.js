/* Modifed by RT to fix some problem with event bubbling/android/jqery/jqm messup */
(function($) {
	var timer = 0;
	var clock;
	var h;
	var m;
	var s;
	var start;
	var stop;
	var reset;
	var stopstart;
	var state; // 0 = stopped , 1 = running
	jQuery.fn.toggleTimer = function(state) {
		if (state) {
			stop.hide();
			start.show();
			jQuery.fn.startTimer();
		} 
	}
	jQuery.fn.startTimer = function() {
		timer = setInterval(jQuery.fn.do_time, 1000);
	}
	
	jQuery.fn.stopTimer = function() {
		clearInterval(timer);
	}
	jQuery.fn.do_time = function() {
		// parseInt() doesn't work here...
		hour = parseFloat(h.text());
		minute = parseFloat(m.text());
		second = parseFloat(s.text());
		
		second++;
		
		if(second > 59) {
			second = 0;
			minute = minute + 1;
		}
		if(minute > 59) {
			minute = 0;
			hour = hour + 1;
		}
		
		h.html("0".substring(hour >= 10) + hour);
		m.html("0".substring(minute >= 10) + minute);
		s.html("0".substring(second >= 10) + second);
	}
	
	jQuery.fn.stopwatch = function(usedefaultcontrols) {
		clock = $(this);
		timer = 0;
		clock.addClass('stopwatch');
		
		// This is bit messy, but IE is a crybaby and must be coddled. 
		clock.html('<div class="display"><span class="hr">00</span>:<span class="min">00</span>:<span class="sec">00</span></div>');
		if (usedefaultcontrols) {
			clock.append('<input type="button" class="start" value="Start" />');
			clock.append('<input type="button" class="stop" value="Stop" />');
			clock.append('<input type="button" class="reset" value="Reset" />'); 
		}
		
		// We have to do some searching, so we'll do it here, so we only have to do it once.
		h = clock.find('.hr');
		m = clock.find('.min');
		s = clock.find('.sec');
		start = clock.find('.start');
		stop = clock.find('.stop');
		reset = clock.find('.reset');
		stopstart = $('#stopstartsubmit');
		state = 0; // 0 = stopped , 1 = running
		stop.hide();
		
		stopstart.live('click', function() {
			if (state == 0) {
				state = 1;
				timer = setInterval(do_time, 1000);
			} else {
				state = 0;
				clearInterval(timer);
			}
		
		});
		
		start.bind('click', function() {
			timer = setInterval(do_time, 1000);
			stop.show();
			start.hide();
		});
		
		stop.bind('click', function() {
			clearInterval(timer);
			timer = 0;
			start.show();
			stop.hide();
		});
		
		reset.bind('click', function() {
			clearInterval(timer);
			timer = 0;
			h.html("00");
			m.html("00");
			s.html("00");
			stop.hide();
			start.show();
		});
	}
})(jQuery);