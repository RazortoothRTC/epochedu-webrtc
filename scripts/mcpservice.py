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
import datetime

# 
#
# Setup cherrypy Tools
#
#
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

encoder = json.JSONEncoder()

def jsonify_tool_callback(*args, **kwargs):
    response = cherrypy.response
    response.headers['Content-Type'] = 'application/json'
    response.body = encoder.iterencode(response.body)
cherrypy.tools.jsonify = cherrypy.Tool('before_finalize', jsonify_tool_callback, priority=30)

def check_access(default=False):
	print "check_access"
	if not getattr(cherrypy.request, "userid", default):
		raise cherrypy.HTTPError(401)
	newauthtools.check_access = cherrypy.Tool('before_request_body', check_access)

_cp_config = {'tools.sessions.on': True}

class MCPService(object):
	#
	# CONFIG
	# 
	# XXX Does cherrypy have some kind of config file thingy?
	ANDROID_CONTENT_PATH = '/sdcard/content'
	DESKTOP_CONTENT_PATH = '/tmp'
	VERSION_TAG = 'ces2011-r1-b1' + datetime.datetime.now().isoformat()
	def __init__(self):
		try:
			self.droid = android.Android()
		except:
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
<h1>Status</h1>
Todo ...
<h1>About</h1>
<UL>Version: %s
</body></html>"""%(self.VERSION_TAG)

	def exit(self):
		raise SystemExit(0)
	exit.exposed = True

	def testviewcraigslist(self):
		aURL = 'http://craigslist.com'
		aMIME = 'text/html'
		droid.view(aURL, aMIME) 
		print "droid view launched"
	testviewcraigslist.exposed = True
	
	@cherrypy.expose
	@cherrypy.tools.validate_rpc()
	@cherrypy.tools.jsonify()
	def rpc(self):
		dataLength = int(cherrypy.request.headers.get('Content-Length') or 0)
		data = cherrypy.request.rfile.read(dataLength)
		jsonReq = {}
		
		try:
			jsonReq = json.load(json.dumps(data))
		except:
			pass
		jsonResp = standardResponse()
		
		apdu = jsonReq['apdu']
		if apdu is None:
			jsonResp['status'] = -1
		if apdu == 1:
			jsonResp = launchurl(jsonReq['launchurl'], None, jsonResp)
		if apdu == 2:
			sync(jsonReq.sync, jsonResp)
		if apdu == 3:
			kill(jsonReq.kill, jsonResp)
		if apdu == 4:
			pass
		if apdu == 5:
			pass
		if apdu == 6:
			pass
		jsonResp = prepareResponse(jsonReq, jsonResp)
		return jsonResp
		
	def prepareResponse(self, req, res):
		res['ticketid'] = req['ticketid'];
		res['timestamp'] = datetime.datetime.now().isoformat()
		# return json.dumps(res) # JSONinfy
		return res
		
	def standardRequest(self):
		return {
		   'apdu': '<ID>',
		   'to': '<recipeint URI>',
		   'requestoruri': '<URL>',
		   'ticketid': '<unique ticket ID>'
		}
		
	def standardResponse(self):
		return {
		   'apduresp': '<unique ticket ID>',
		   'sender': '<sender URI>',
		   'status': '<status code, negative for error conditions, 0 for success>'
		}
			
#
#
# MCP Handlers
#
#
	def launchurl(self, aurl, amime, rsp):
		if aurl is None: rsp.status = -1
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
		rsp['status'] = 0;
		return rsp
		
	def sync(self, urls, rsp):
		downloaderrors = []
		if urls is None: return rsp
		for contenturl in urls:
			try:
				webFile = urllib.urlopen(contenturl)
				localFile = open(ANDROID_CONTENT_PATH, 'w') # XXX Double check the write bits
				localFile.write(webFile.read())
				webFile.close()
				localFile.close()
			except IOError, e:
				downloaderrors.append(contenturl)
		rsp['downloaderrors'] = downloaderrors
		if len(downloaderrors) > 0:
			rsp['status'] = -1;
		else:
			rsp['status'] = 0;
		return rsp
	def kill(self, uri, rsp):
		if uri is None: return rsp
		droid.forceStopPackage(uri) # Does this have return value?
		rsp['status'] = 0;
		
def run():
    cherrypy.config.update({'cherrypy.server.socket_port':'8080'})
    cherrypy.config.update({'server.socket_host':'127.0.0.1'})
    cherrypy.quickstart(MCPService(), '/')
    cherrypy.engine.block()

if __name__ == '__main__':
    run()
