"""
	MCPService 

	Prototype built on top of CherryPy.  
	Loosely (actually, exactly) based on example on cherrypy.org:
	http://www.cherrypy.org/browser/trunk/cherrypy/tutorial/tut01_helloworld.py

	Need to get license header for that code.

	Add handler routes as needed

	Spec for MCP is here: http://www.box.net/shared/j3xka7ofy5

	Note, all inbound requests are expected to be JSON, as are the responses.

"""
import logging
# The multiprocessing package isn't
# part of the ASE installation so
# we must disable multiprocessing logging
logging.logMultiprocessing = 0
 
import android
import webbrowser # XXX Leave this in, it may be useful
import cherrypy
import os
import json

class StreamFilter(cherrypy.filters.basefilter.BaseFilter):
	def before_request_body(self):
		if cherrypy.request.path == '/rpc':
			if not 'Content-Length' in cherrypy.request.headerMap or \
				(cherrypy.request.method != 'POST'):
				raise cherrypy.HTTPRedirect('/'):
			else:
				cherrypy.request.processRequestBody = False
		

class MCPService(object):
    def __init__(self):
        self.droid = android.Android()

    """ Sample request handler class. """
    def index(self):
        return """<html><head><title>MCP Service</title></head>
<body>
<h1>Services Overview</h1>
Put services documentation here.
<hr>
<h1>Administration</h1>
<a href="/dumpqueue">Queue Dump</a>
<a href="/exit">Shutdown</a>
</body></html>"""
    index.exposed = True

    def exit(self):
        raise SystemExit(0)
    exit.exposed = True

	def testviewcraigslist(selfd):
		aURL = 'http://craigslist.com'
		aMIME = 'text/html'
	    droid.view(aURL, aMIME) 
	testviewcraigslist.exposed = True
	
	def launchurl(self, aurl, amime):
		if aurl is None return
		if amime is None:
			droid.view(aurl)
		else:
			droid.view(aurl, amime)
	
	def rpc(self):
		dataLength = int(cherrypy.request.headers.get('Content-Length') or 0)
		data = cherrypy.request.rfile.read(dataLength)
		o = json.dumps(data)
		
		requestID = o.apdu
		if requestID is None:
			pass
		if requestID == 1:
			launchurl(o.launchurl, None)
		if requestID == 2:
			pass
		if requestID == 3:
			pass
		if requestID == 4:
			pass
		if requestID == 5:
			pass
		if requestID == 6
			pass
		
		
		
def run():
    cherrypy.config.update({'cherrypy.server.socket_port':'8080'})
    cherrypy.config.update({'server.socket_host':'127.0.0.1'})
    cherrypy.quickstart(MCPService(), '/')
    cherrypy.engine.subscribe('start', browse, priority=90)
    cherrypy.engine.block()
    #os.system('python script.py')

if __name__ == '__main__':
    run()
