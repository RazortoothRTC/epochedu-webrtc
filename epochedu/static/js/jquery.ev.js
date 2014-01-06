/* Title: jQuery.ev
 *
 * A COMET event loop for jQuery
 *
 * $.ev.loop long-polls on a URL and expects to get an array of JSON-encoded
 * objects back.  Each of these objects should represent a message from the COMET
 * server that's telling your client-side Javascript to do something.
 *
 */
(function($){

  $.ev = {

    handlers : {},
    running  : false,
    xhr      : null,
    verbose  : true,
    timeout  : null, // PASS THIS VALUE IN!

    /* Method: run
     *
     * Respond to an array of messages using the object in this.handlers
     *
     */
    run: function(messages) {
      var i, m, h; // index, event, handler 
	  if (messages != null) {
	  	console.log('>>>>>>run invoked: messages length = ' + messages.length + ' - ' + new Date());
	      for (i = 0; i < messages.length; i++) {
	        m = messages[i];
	        if (!m) continue;
	        h = this.handlers[m.type];
	        if (!h) h = this.handlers['*'];
	        if ( h) h(m);
	      }
		  return true;
  	  }	else {
		// alert('fail!');
		console.error('>>>>>>messages object is null, wait a bit - ' + new Date());
		// window.location.href = unescape(window.location.pathname);
		setTimeout(function () { /* do nada */}, 10000); // XXX
		self.status = null;
		return false;
	  }
    },

    /* Method: stop
     *
     * Stop the loop
     *
     */
    stop: function() {
	  console.log('>>>>>>>>>>>stop loop: - ' + new Date());
      if (this.xhr) {
        this.xhr.abort();
        this.xhr = null;
      }
      this.running = false;
    },

    /*
     * Method: loop
     *
     * Long poll on a URL
     *
     * Arguments:
     *
     *   url
     *   handler
     *
     */
    loop: function(url, handlers) {
	  console.log('>>>>>>>>>>>>>ev.loop again - ' + new Date());
      var self = this;
      if (handlers) {
        if (typeof handlers == "object") {
          this.handlers = handlers;
        } else if (typeof handlers == "function") {
          this.run = handlers;
        } else {
          throw("handlers must be an object or function");
        }
      }
      this.running = true;
      this.xhr = $.ajax({
        type     : 'GET',
        dataType : 'json',
        url      : url,
        timeout  : self.timeout,
        success  : function(messages, status, xhr) {
          // console.log('>>>>>>success', messages);
		  if (xhr.status >= 200 && xhr.status < 300) self.run(messages);
        },
		error 	 : function(xhr, textStatus) { console.log(">>>>>>>>>>AJAX ERROR: Type: "+textStatus.name);},
        complete : function(xhr, status) {
          var delay;
		  if (status == 'success') { // Guard against false success
          	if (xhr && (xhr.status >= 200 && xhr.status < 300)) {
	            delay = 100;
				console.log('>>>>>>status: success retry in 100ms - ' + new Date());
	          } else {
	            console.log('>>>>>>status: ' + xhr.status, '; waiting before long-polling again... - ' + new Date());
	            delay = 5000;
	          }
	  	  }	
          // "recursively" loop
		  console.log('>>>>>>>>self.running = ' + self.running + ' - ' + new Date());
          window.setTimeout(function(){ if (self.running) self.loop(url); }, delay);
        }
      });
    }

  };

})(jQuery);
