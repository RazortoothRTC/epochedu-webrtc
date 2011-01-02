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
import time
import urllib
import types

#
#
# MISC Globals
#
#

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
				(cherrypy.request.method != 'POST') or \
				(cherrypy.request.method != 'GET'):
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
	droid = None
	#
	# CONFIG
	# 
	# XXX Does cherrypy have some kind of config file thingy?
	ANDROID_CONTENT_PATH = '/sdcard/content'
	DESKTOP_CONTENT_PATH = '/tmp'
	VERSION_TAG = 'ces2011-r4-b2' + datetime.datetime.now().isoformat()
	VERSION_DESC = """
	<P>MCP Work in progress.  mcpmodestart, mcpmodestop are the items in progress.  Fix missing self reference on kill.</P>
	"""
	ASCII_LOGO = """
	@#@#++@@@@@@@@@@@
	@+++++++#@@+@@@@@
	@++++@@#+@@,+@@@@
	@#++@;,::;+,:@@@@
	@#++@@@@@#',,:+@@
	@@++@@@@@@@,;@:@@
	@@#+#@@@@@@,'@@@@
	@@@++@@@@@+,@@@@@
	@@@@+@@@@@,;@@@@@
	@@@@@+@@@#:@@@@@#
	@@@@@@#@@:@@@@@@@
	@@@@@@@##@@@@@@@@
	@@@@@@@@@@@@@@@@@
	"""
	ASCII_LOGO2 = """
	|~) _ _  _ .__|_ _  _ _|_|_ 
	|~\(_|/_(_)|  | (_)(_) | | |

	|~ _ ._ _ ._ _    ._ o _ _ _|_o _ ._  _   
	|_(_)| | || | ||_|| ||(_(_| | |(_)| |_\)  

	| | |~
	|_|_|_
	"""
	COPYRIGHT = 'Copyright 2011 Razortooth Communications, LLC'
	MCP_SERVER_URI = ['http://192.168.1.148:5000/student'] # XXX This should be a list, DEMOSETTING
	PACKAGE_BLACKLIST = ['com.android.browser', # Android Browser
						'com.android.launcher2', # The Dock Launcher
						]
	PACKAGE_RESTORELIST = []
	
	def __init__(self):
		try:
			self.droid = android.Android()
		except:
			print 'Exception initializing Android'
		print 'MCPService init completed'
		
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
<UL>Version: %s</UL>
<UL>Description: %s</UL>
</body></html>"""%(self.VERSION_TAG, self.VERSION_DESC)

	def exit(self):
		raise SystemExit(0)
	exit.exposed = True

	def testviewcraigslist(self):
		aURL = 'http://craigslist.com'
		aMIME = 'text/html'
		droid.view(aURL, aMIME) 
		print "droid view launched"
	testviewcraigslist.exposed = True
	
	# 	@cherrypy.tools.validate_rpc()
	@cherrypy.expose
	@cherrypy.tools.jsonify()
	# def rpc(self, apdu, ticketid, to, requestoruri, launchurl="None", sync="None", kill="None"):
	def rpc(self, **params):
		dataLength = int(cherrypy.request.headers.get('Content-Length') or 0)
		data = {}
		# apdu = None
		if (cherrypy.request.method == 'POST'):
			print "rpc: POST method"
			data = cherrypy.request.rfile.read(dataLength)
		else:
			print "rpc: GET method"
			data = cherrypy.request.params;
			# print data
		jsonReq = {}
		
		#try:
		#	jsonReq = json.load(json.dumps(data))
		#	print jsonReq
		# except:
		#	print 'couldn not get json data'
		jsonResp = self.standardResponse()
		
		# try:
		#	apdu = jsonReq['apdu']
		#	print 'apdu received: ' + apdu
		#except KeyError, e:
		#	print "Can't get apdu from request" 
		print params
		apdu = params['apdu']
		if apdu is None:
			jsonResp['status'] = -1
		print 'apdu received: ' + apdu
		if apdu == '1':
			jsonResp = self.launchurl(params['launchurl'], None, jsonResp)
		if apdu == '2':
			print 'sync value is ' + params['sync']
			jsonResp = self.syncContent(params['sync'], jsonResp)
		if apdu == '3':
			jsonResp = self.kill(kill, jsonResp)
		if apdu == '4':
			jsonResp = self.mcpmodestart(jsonResp)
		if apdu == '5':
			jsonResp = self.mcpmodestop(jsonResp)
		if apdu == '6':
			pass
		jsonResp = self.prepareResponse(jsonReq, jsonResp)
		return jsonResp
		
	def prepareResponse(self, req, res):
		try:
			res['ticketid'] = req['ticketid'];
		except KeyError, e:
			res['ticketid'] = 'unknown'
			
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
# MCP apdu Handlers
#
#
	def launchurl(self, aurl, amime, rsp):
		if aurl is None: rsp.status = -1
		if amime is None:
			try:
				self.droid.view(aurl)
			except:
				webbrowser.open(aurl)
			print "droid view launched with url"
		else:
			try:
				self.droid.view(aurl, amime)
			except:
				webbrowser.open(aurl)  
			print "droid view launched with mime type + url"
		rsp['status'] = 0;
		return rsp
		
	def syncContent(self, urls, rsp):
		downloaderrors = []
		print "syncing content to device"
		# 
		# XXX We need to get the path off and create directory if needed
		#
		if urls is None: 
			print 'urls are empty'
			return rsp

		print 'singuar sync'
		
		try:
			print "syncing single url: " + urls
			webFile = urllib.urlopen(urls)
			filename = urls.split('/')[-1]
			apath = self.ANDROID_CONTENT_PATH + '/' + urls.split('/')[-2] 
			dpath = self.DESKTOP_CONTENT_PATH + '/' + urls.split('/')[-2]
			if not os.path.exists(apath):
				try:
					os.makedirs(apath)
				except OSError, e:
					if not os.path.exists(dpath):
						try:
							os.makedirs(dpath)
						except OSError, e:
							print 'could not create a valid path at' + apath + ' or ' + dpath
							return
			try:
				localFile = open(apath + '/' + filename, 'wa') # XXX Double check the write bits
				print 'storing url on ' + apath + '/'  + filename
			except IOError, e:
				localFile = open(dpath + '/' + filename, 'wa') # XXX Double check the write bits
				print 'storing url on ' + dpath + '/' + filename
			localFile.write(webFile.read())
			webFile.close()
			localFile.close()
		except IOError, e:
			downloaderrors.append(urls)
			print "errors syncing " + urls
			print e
		rsp['downloaderrors'] = downloaderrors
		if len(downloaderrors) > 0:
			rsp['status'] = -1;
		else:
			rsp['status'] = 0;
		print "returning from sync"
		return rsp
		
	def kill(self, uri, rsp):
		if uri is None: return rsp
		self.droid.forceStopPackage(uri) # Does this have return value?
		self.droid.makeToast('Killed ' + uri)
		rsp['status'] = 0;
		return rsp
	
	def mcpmodestart(self, rsp):
		# XXX Put in list of packages to kill
		# check if we can get a list of running activities
		# Also, is there a way to disable the system softkeys (HOME, MENU, Back)
		# 
		print "mcpmodestart invoked"
		for packagename in self.PACKAGE_BLACKLIST:
			self.kill(packagename, rsp)
			self.PACKAGE_RESTORELIST.append(packagename) # Save these to restore later
		rsp['status'] = 0;
		return rsp
	
	def mcpmodestop(self, rsp):
		# XXX Add code to relaunch killed apps
		print "mcpmodestop invoked"
		for packagename in self.PACKAGE_RESTORELIST:
			print "attempting to restore " + packagename
		rsp['status'] = 0;
		return rsp

def mcpServiceConnector():
	print "here 1"
	svc = MCPService()
	print "here 2"
	droid = svc.droid
	mcpconnectorurl = svc.MCP_SERVER_URI[0]
	try:
		droid.makeToast('Launcing MCP service connector: ' + mcpconnectorurl)	
		droid.view(mcpconnectorurl, 'text/html')
	except:
		print "opening " + mcpconnectorurl
		webbrowser.open(mcpconnectorurl)
	# print svc.ASCII_LOGO
	print svc.ASCII_LOGO2
	print svc.COPYRIGHT
	
def run():
	
	cherrypy.config.update({'cherrypy.server.socket_port':'8080'})
	cherrypy.config.update({'server.socket_host':'127.0.0.1'})
	cherrypy.engine.subscribe('start', mcpServiceConnector, priority=90)
	cherrypy.quickstart(MCPService(), '/')
	cherrypy.engine.block()

if __name__ == '__main__':
    run()
