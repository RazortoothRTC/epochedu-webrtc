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
import threading

#
#
# MISC Globals
#
#
ismcpmodeon = False # Stupid global for testing whether we got an mcpmodestart

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

#
# Global config
#
_cp_config = {'tools.sessions.on': True}
MCP_CONFIG = {'ANDROID_CONTENT_PATH':'/sdcard/content', 
			  'DESKTOP_CONTENT_PATH': '/tmp', 'MCP_SERVER_URI' : ['http://192.168.1.148:5000/student'],
			  'MCP_TICK_INTERVAL' : 30, # Seconds between ticks
			  'CONTENT_REPO_LOCAL_URL' : "content://com.android.htmlfileprovider/sdcard/content", 
			  'ANDROID_VIEW_ACTIVITY' : 'android.intent.action.VIEW', # These are documented in Android Dev Docs
			'ASCII_LOGO' : """
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
			""",
			'ASCII_LOGO2' : """
			|~) _ _  _ .__|_ _  _ _|_|_ 
			|~\(_|/_(_)|  | (_)(_) | | |

			|~ _ ._ _ ._ _    ._ o _ _ _|_o _ ._  _   
			|_(_)| | || | ||_|| ||(_(_| | |(_)| |_\)  

			| | |~
			|_|_|_
			""",
			'COPYRIGHT' : 'Copyright 2011 Razortooth Communications, LLC'
			  }

class MCPService(object):
	droid = None
	mcpmodeison = False
	
	#
	# CONFIG
	# 
	# XXX Does cherrypy have some kind of config file thingy?
	ANDROID_CONTENT_PATH = '/sdcard/content'
	DESKTOP_CONTENT_PATH = '/tmp'
	VERSION_TAG = 'ces2011-r5-b1-' + datetime.datetime.now().isoformat()
	VERSION_DESC = """
	<P>MCP Work in progress. Added first rev of contentpullsync.  RPC needs to still fix handling of JSON call.</P>
	"""
	# XXX Cleanup this duplicate config code, move it into global MCP_CONFIG
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
						'com.android.launcher', # The Dock Launcher
						'com.android.settings', # Settings
						]
	PACKAGE_RESTORELIST = []
	
	def __init__(self):
		try:
			self.droid = android.Android()
		except:
			print 'Exception initializing Android'
		print 'MCPService init completed'
		# XXX Put t into a shutdown hook so it gets stopped or canceled
		# XXX Uncomment after we are done developing UI
		# self.t = threading.Timer(10.0, mcploop).start()
		
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

	# XXX Test Route, remove
	@cherrypy.expose
	@cherrypy.tools.jsonify()
	def testjson1(self):
		jsonResp = {'foo': 1, 'bar': 'b'}
		return jsonResp
		
	@cherrypy.expose
	# @cherrypy.tools.jsonify()
	def contentsyncpull(self, **params):
		print params
		channel = params['channel']
		jsoncallback = params['jsoncallback']
		
		if channel is not None:
			print "/contentsyncpull received request for channel " + channel
		else:
			print "/contentsyncpull didn't receive channel parameter"
		# Dummy fixture
		results = ["http://192.168.1.148:5000/content/foo/1.jpg","http://192.168.1.148:5000/content/foo/108942.jpg","http://192.168.1.148:5000/content/foo/116136642_1a928c013a.jpg","http://192.168.1.148:5000/content/foo/2.jpg","http://192.168.1.148:5000/content/foo/2010-09-29%2016.58.08.jpg","http://192.168.1.148:5000/content/foo/251_rhode_island_floorplan-1.jpg","http://192.168.1.148:5000/content/foo/251_rhode_island_floorplan-2.jpg","http://192.168.1.148:5000/content/foo/251_rhode_island_floorplan.jpg","http://192.168.1.148:5000/content/foo/25938_PE103626_S4.jpg","http://192.168.1.148:5000/content/foo/310.jpg","http://192.168.1.148:5000/content/foo/3946055_f67b05180b_o.jpg","http://192.168.1.148:5000/content/foo/6a4a64a35510f0e8.jpg","http://192.168.1.148:5000/content/foo/72970129_fa08a7a531.jpg","http://192.168.1.148:5000/content/foo/98993461_593c72d2dc_o.jpg"]
		jsonResp = json.dumps({'resultsCount' : len(results), 'results': results})
		return jsoncallback + '(' + jsonResp + ');'
		
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

	#
	# MCP messsage factories
	# 
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
	# MCP apdu Handlers
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
			try:
				localFile.write(webFile.read())
				self.notifyUser("Completed sync of " + filename + " to sd card.", "Teacher Content Sync'd")
			except IOError, e:
				print 'error storing to ' + apath
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
		ismcpmodeon = True
		for packagename in self.PACKAGE_BLACKLIST:
			self.kill(packagename, rsp)
			self.PACKAGE_RESTORELIST.append(packagename) # Save these to restore later
		rsp['status'] = 0;
		self.notifyUser("Starting Teacher Control Mode")
		return rsp
	
	def mcpmodestop(self, rsp):
		# XXX Add code to relaunch killed apps
		print "mcpmodestop invoked"
		ismcpmodeon = False
		for packagename in self.PACKAGE_RESTORELIST:
			print "attempting to restore " + packagename
		rsp['status'] = 0;
		self.notifyUser("Ending Teacher Control Mode")
		return rsp
	
	#
	# MCP Utility Methods
	# 
	def notifyUser(self, message, title=None):
		print message
		self.droid.makeToast(message)
		self.droid.ttsSpeak(message)
		
		if title is not None:
			self.droid.notify(title, message)

def mcploop():
	print "mcploop"
	loopcount = 0
	droid = None
	tickinterval = MCP_CONFIG['MCP_TICK_INTERVAL']
	try:
		droid = android.Android()
	except:
		pass
		
	while True:
		time.sleep(0.3)
		print "MCP Teachers Assistant is waking up to check on you, heartbeat #%d"%(loopcount)
		# XXX We may want to put some housekeeping work here
		if ismcpmodeon:
			if droid is not None:
				pkgs = droid.getRunningPackages()[1] # XXX ugly ... 
				if 'com.android.launcher' in pkgs:
					droid.makeToast("Teacher's Assistant sending user back to class")
					droid.ttsSpeak("Please return to class")
					droid.forceStopPackage('com.android.launcher')
					# droid.view(MCP_CONFIG['MCP_SERVER_URI'][0], "text/html") # XXX These calls block :(, so page better load
					droid.startActivity(MCP_CONFIG['ANDROID_VIEW_ACTIVITY'], MCP_CONFIG['MCP_SERVER_URI'][0], None, None, False)
		loopcount = loopcount + 1
		time.sleep(tickinterval)
			
def mcpServiceConnector():
	print "here 1"
	# svc = MCPService()
	print "here 2"
	# droid = svc.droid
	droid = None
	try:
		droid = android.Android()
	except:
		print "running in desktop mode"
	mcpconnectorurl = MCP_CONFIG['MCP_SERVER_URI'][0]
	
	try:
		droid.makeToast('Launcing MCP service connector: ' + mcpconnectorurl)	
		# droid.view(mcpconnectorurl, 'text/html')
		droid.startActivity(MCP_CONFIG['ANDROID_VIEW_ACTIVITY'], MCP_CONFIG['MCP_SERVER_URI'][0], None, None, False)
	except:
		print "opening " + mcpconnectorurl
		webbrowser.open(mcpconnectorurl)
	print MCP_CONFIG['ASCII_LOGO2']
	print MCP_CONFIG['COPYRIGHT']

	
def run():
	cherrypy.tree.mount(MCPService())
	cherrypy.config.update({'cherrypy.server.socket_port':'8080'})
	cherrypy.config.update({'server.socket_host':'127.0.0.1'})
	if hasattr(cherrypy.engine, "signal_handler"):
	    cherrypy.engine.signal_handler.subscribe()
	if hasattr(cherrypy.engine, "console_control_handler"):
	    cherrypy.engine.console_control_handler.subscribe()
	
	# cherrypy.engine.start(blocking=False)
	# cherrypy.quickstart()
	cherrypy.engine.subscribe('start', mcpServiceConnector, priority=90)
	# cherrypy.quickstart(MCPService(), '/')
	cherrypy.engine.start()
	# threading.Timer(10.0, mcploop).start()
	cherrypy.engine.block()

if __name__ == '__main__':
    run()
