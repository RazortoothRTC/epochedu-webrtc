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
 
try:
	import android
except:
	import webbrowser # XXX Leave this in, it may be useful for linux/mac testing
import cherrypy
import os
import json


def print_path(multiplier=1):
    for i in range(multiplier):
        print cherrypy.request.path_info
cherrypy.tools.print_path = cherrypy.Tool('on_start_resource', print_path)

def validate_rpc():
		if cherrypy.request.path_info == '/rpc':
			if not 'Content-Length' in cherrypy.request.headers or \
				(cherrypy.request.method != 'POST'):
				raise cherrypy.HTTPRedirect('/')
			else:
				cherrypy.request.processRequestBody = False
cherrypy.tools.validate_rpc = cherrypy.Tool('before_request_body', validate_rpc)

def check_access(default=False):
	print "check_access"
	if not getattr(cherrypy.request, "userid", default):
		raise cherrypy.HTTPError(401)
	newauthtools.check_access = cherrypy.Tool('before_request_body', check_access)

_cp_config = {'tools.sessions.on': True}

class MCPService(object):
	def __init__(self):
		# self.droid = android.Android()
		pass

	""" Basic MCP Service - need to add auth """
	@cherrypy.expose
	def index(self):
		return """<html><head><title>MCP Service</title></head>
<body>
<h1>MCP Services Overview</h1>
Put services documentation here.
<hr>
<h1>Administration</h1>
<a href="/dumpqueue">Queue Dump</a>
<a href="/exit">Shutdown</a>
</body></html>"""

	def exit(self):
		raise SystemExit(0)
	exit.exposed = True

	def testviewcraigslist(self):
		aURL = 'http://craigslist.com'
		aMIME = 'text/html'
	    # droid.view(aURL, aMIME) 
		print "droid view launched"
	testviewcraigslist.exposed = True
	
	@cherrypy.expose
	@cherrypy.tools.validate_rpc()
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
		if requestID == 6:
			pass
		
		# Set the response header
		# set the data body
		# send response
		
	def launchurl(self, aurl, amime):
		if aurl is None: return
		if amime is None:
			try:
				droid.view(aurl)
			except:
				webbrowser.open(aurl)  
			print "droid view launched with url"
		else:
			try:
				droid.view(aurl, amime)
			except:
				webbrowser.open(aurl)  
			print "droid view launched with mime type + url"
		
def run():
    cherrypy.config.update({'cherrypy.server.socket_port':'8080'})
    cherrypy.config.update({'server.socket_host':'127.0.0.1'})
    cherrypy.quickstart(MCPService(), '/')
    cherrypy.engine.block()
    #os.system('python script.py')

if __name__ == '__main__':
    run()
