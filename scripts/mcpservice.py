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
import threading
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
import urllib2
import types
import threading

#
# Utility Class
# 
class BackgroundSync(threading.Thread): # Need to figure out how scoping works on this
	def __init__ (self, syncurl, mcpserviceref, syncnick):
		threading.Thread.__init__(self)
		self.syncurl = syncurl
		self.mcpserviceref = mcpserviceref
		self.syncnick = syncnick
	
	def setURL(self, syncurl):
		self.syncurl = syncurl
		
	def run(self):
		downloaderrors = []
		urls = self.syncurl
		# 
		# XXX We need to get the path off and create directory if needed
		#
		if urls is None: 
			print 'urls are empty'

		print 'threaded sync'
		
		try:
			print "syncing single url: " + urls
			classroom = urls.split('/')[-2] 
			apath = self.mcpserviceref.ANDROID_CONTENT_PATH + '/' + classroom
			dpath = self.mcpserviceref.DESKTOP_CONTENT_PATH + '/' + classroom
			filename = urls.split('/')[-1]
			if (not os.path.exists(apath + '/' + filename)) and (not os.path.exists(dpath + '/' + filename)):
				webFile = urllib.urlopen(urls)
				
				if not os.path.exists(apath):
					try:
						os.makedirs(apath)
					except OSError, e:
						print "may not be on android, could not create path " + apath + ", trying local path " + dpath
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
					# XXX Android tablet can't handle this for large files localFile.write(webFile.read())
					maxread = MCP_CONFIG['SYNC_MAX_BYTES_READ']
					bytesread = None
					while 1:
						bytesread = webFile.read(maxread)
						if bytesread == '': # I guess this is the EOF way in Python
							break
						localFile.write(bytesread)
						
					mcpconnectorurl = MCP_CONFIG['MCP_SERVER_ADDRESS'][0] + MCP_CONFIG['SYNCACK_ENDPOINT'] + '/' + classroom + "?syncnick=%s&fname=%s"%(self.syncnick, filename)
					urllib2.urlopen(mcpconnectorurl).read()
					try:
						self.mcpserviceref.notifyUser("Completed sync of " + filename + " to sd card.", "Teacher Content Synched")
					except:
						print "Completed sync of " + filename + " to sd card."
				except IOError, e:
					try:
						self.mcpserviceref.notifyUser("Unable to completed sync of " + filename + " to sd card: IOError.", "Teacher Content Sync Failed")
					except:
						pass
					print 'error storing to ' + apath
				webFile.close()
				localFile.close()
			else:
				try:
					mcpconnectorurl = MCP_CONFIG['MCP_SERVER_ADDRESS'][0] + MCP_CONFIG['SYNCACK_ENDPOINT'] + '/' + classroom + "?syncnick=%s&fname=%s"%(self.syncnick, filename)
					urllib2.urlopen(mcpconnectorurl).read()
					self.mcpserviceref.notifyUser('url ' + urls + ' already synced to device', "Teacher Content Synched")
				except:
					pass
				print 'url ' + urls + ' already synced to device'
		except IOError, e:
			downloaderrors.append(urls)
			print "errors syncing " + urls
			print e
#
#
# MISC Globals
#
#
mcpmodetoggle = 0 # Stupid global for testing whether we got an mcpmodestart

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
MCP_CONFIG = {'MCP_SERVER_ADDRESS':['http://192.168.1.16:5000'], # DEMOSETUP
			  'STUDENT_ENDPOINT':'/student', 
			  'SYNCACK_ENDPOINT':'/syncack',
			  'ANDROID_CONTENT_PATH':'/sdcard/content', 
			  'DESKTOP_CONTENT_PATH':'/tmp',
			  'SYNC_MAX_BYTES_READ': 1024, # Read at most 1K 
			  'SYNCACK_PARAM':'syncack', # Used for sync ack
			  'MCP_TICK_INTERVAL':15, # Seconds between ticks DEMOSETUP
			  'CONTENT_REPO_LOCAL_URL' : "content://com.android.htmlfileprovider", 
			  'ANDROID_VIEW_ACTIVITY' : 'android.intent.action.VIEW', # These are documented in Android Dev Docs
			  'VALID_FILE_EXTENSIONS' : ['.jpg', '.gif', '.png', '.mov', '.mp3', '.wav', '.mp4', '.flv', '.3gp', '.html', '.tif', '.apk', '.txt', '.doc', '.rtf', '.pdf'],
			  'VALID_MIME_TYPES' : {    ".3gp"   : "video/3gpp" # BORROWED FROM fu.js (see source for epochedu-master)
			          				  , ".a"     : "application/octet-stream"
							          , ".ai"    : "application/postscript"
							          , ".aif"   : "audio/x-aiff"
							          , ".aiff"  : "audio/x-aiff"
							          , ".asc"   : "application/pgp-signature"
							          , ".asf"   : "video/x-ms-asf"
							          , ".asm"   : "text/x-asm"
							          , ".asx"   : "video/x-ms-asf"
							          , ".atom"  : "application/atom+xml"
							          , ".au"    : "audio/basic"
							          , ".avi"   : "video/x-msvideo"
							          , ".bat"   : "application/x-msdownload"
							          , ".bin"   : "application/octet-stream"
							          , ".bmp"   : "image/bmp"
							          , ".bz2"   : "application/x-bzip2"
							          , ".c"     : "text/x-c"
							          , ".cab"   : "application/vnd.ms-cab-compressed"
							          , ".cc"    : "text/x-c"
							          , ".chm"   : "application/vnd.ms-htmlhelp"
							          , ".class"   : "application/octet-stream"
							          , ".com"   : "application/x-msdownload"
							          , ".conf"  : "text/plain"
							          , ".cpp"   : "text/x-c"
							          , ".crt"   : "application/x-x509-ca-cert"
							          , ".css"   : "text/css"
							          , ".csv"   : "text/csv"
							          , ".cxx"   : "text/x-c"
							          , ".deb"   : "application/x-debian-package"
							          , ".der"   : "application/x-x509-ca-cert"
							          , ".diff"  : "text/x-diff"
							          , ".djv"   : "image/vnd.djvu"
							          , ".djvu"  : "image/vnd.djvu"
							          , ".dll"   : "application/x-msdownload"
							          , ".dmg"   : "application/octet-stream"
							          , ".doc"   : "application/msword"
							          , ".dot"   : "application/msword"
							          , ".dtd"   : "application/xml-dtd"
							          , ".dvi"   : "application/x-dvi"
							          , ".ear"   : "application/java-archive"
							          , ".eml"   : "message/rfc822"
							          , ".eps"   : "application/postscript"
							          , ".exe"   : "application/x-msdownload"
							          , ".f"     : "text/x-fortran"
							          , ".f77"   : "text/x-fortran"
							          , ".f90"   : "text/x-fortran"
							          , ".flv"   : "video/x-flv"
									  , ".apk"	 : "application/vnd.android.package-archive"
							          , ".for"   : "text/x-fortran"
							          , ".gem"   : "application/octet-stream"
							          , ".gemspec" : "text/x-script.ruby"
							          , ".gif"   : "image/gif"
							          , ".gz"    : "application/x-gzip"
							          , ".h"     : "text/x-c"
							          , ".hh"    : "text/x-c"
							          , ".htm"   : "text/html"
							          , ".html"  : "text/html"
							          , ".ico"   : "image/vnd.microsoft.icon"
							          , ".ics"   : "text/calendar"
							          , ".ifb"   : "text/calendar"
							          , ".iso"   : "application/octet-stream"
							          , ".jar"   : "application/java-archive"
							          , ".java"  : "text/x-java-source"
							          , ".jnlp"  : "application/x-java-jnlp-file"
							          , ".jpeg"  : "image/jpeg"
							          , ".jpg"   : "image/jpeg"
							          , ".js"    : "application/javascript"
							          , ".json"  : "application/json"
							          , ".log"   : "text/plain"
							          , ".m3u"   : "audio/x-mpegurl"
							          , ".m4v"   : "video/mp4"
							          , ".man"   : "text/troff"
							          , ".mathml"  : "application/mathml+xml"
							          , ".mbox"  : "application/mbox"
							          , ".mdoc"  : "text/troff"
							          , ".me"    : "text/troff"
							          , ".mid"   : "audio/midi"
							          , ".midi"  : "audio/midi"
							          , ".mime"  : "message/rfc822"
							          , ".mml"   : "application/mathml+xml"
							          , ".mng"   : "video/x-mng"
							          , ".mov"   : "video/quicktime"
							          , ".mp3"   : "audio/mpeg"
							          , ".mp4"   : "video/mp4"
							          , ".mp4v"  : "video/mp4"
							          , ".mpeg"  : "video/mpeg"
							          , ".mpg"   : "video/mpeg"
							          , ".ms"    : "text/troff"
							          , ".msi"   : "application/x-msdownload"
							          , ".odp"   : "application/vnd.oasis.opendocument.presentation"
							          , ".ods"   : "application/vnd.oasis.opendocument.spreadsheet"
							          , ".odt"   : "application/vnd.oasis.opendocument.text"
							          , ".ogg"   : "application/ogg"
							          , ".p"     : "text/x-pascal"
							          , ".pas"   : "text/x-pascal"
							          , ".pbm"   : "image/x-portable-bitmap"
							          , ".pdf"   : "application/pdf"
							          , ".pem"   : "application/x-x509-ca-cert"
							          , ".pgm"   : "image/x-portable-graymap"
							          , ".pgp"   : "application/pgp-encrypted"
							          , ".pkg"   : "application/octet-stream"
							          , ".pl"    : "text/x-script.perl"
							          , ".pm"    : "text/x-script.perl-module"
							          , ".png"   : "image/png"
							          , ".pnm"   : "image/x-portable-anymap"
							          , ".ppm"   : "image/x-portable-pixmap"
							          , ".pps"   : "application/vnd.ms-powerpoint"
							          , ".ppt"   : "application/vnd.ms-powerpoint"
							          , ".ps"    : "application/postscript"
							          , ".psd"   : "image/vnd.adobe.photoshop"
							          , ".py"    : "text/x-script.python"
							          , ".qt"    : "video/quicktime"
							          , ".ra"    : "audio/x-pn-realaudio"
							          , ".rake"  : "text/x-script.ruby"
							          , ".ram"   : "audio/x-pn-realaudio"
							          , ".rar"   : "application/x-rar-compressed"
							          , ".rb"    : "text/x-script.ruby"
							          , ".rdf"   : "application/rdf+xml"
							          , ".roff"  : "text/troff"
							          , ".rpm"   : "application/x-redhat-package-manager"
							          , ".rss"   : "application/rss+xml"
							          , ".rtf"   : "application/rtf"
							          , ".ru"    : "text/x-script.ruby"
							          , ".s"     : "text/x-asm"
							          , ".sgm"   : "text/sgml"
							          , ".sgml"  : "text/sgml"
							          , ".sh"    : "application/x-sh"
							          , ".sig"   : "application/pgp-signature"
							          , ".snd"   : "audio/basic"
							          , ".so"    : "application/octet-stream"
							          , ".svg"   : "image/svg+xml"
							          , ".svgz"  : "image/svg+xml"
							          , ".swf"   : "application/x-shockwave-flash"
							          , ".t"     : "text/troff"
							          , ".tar"   : "application/x-tar"
							          , ".tbz"   : "application/x-bzip-compressed-tar"
							          , ".tcl"   : "application/x-tcl"
							          , ".tex"   : "application/x-tex"
							          , ".texi"  : "application/x-texinfo"
							          , ".texinfo" : "application/x-texinfo"
							          , ".text"  : "text/plain"
							          , ".tif"   : "image/tiff"
							          , ".tiff"  : "image/tiff"
							          , ".torrent" : "application/x-bittorrent"
							          , ".tr"    : "text/troff"
							          , ".txt"   : "text/plain"
							          , ".vcf"   : "text/x-vcard"
							          , ".vcs"   : "text/x-vcalendar"
							          , ".vrml"  : "model/vrml"
							          , ".war"   : "application/java-archive"
							          , ".wav"   : "audio/x-wav"
							          , ".wma"   : "audio/x-ms-wma"
							          , ".wmv"   : "video/x-ms-wmv"
							          , ".wmx"   : "video/x-ms-wmx"
							          , ".wrl"   : "model/vrml"
							          , ".wsdl"  : "application/wsdl+xml"
							          , ".xbm"   : "image/x-xbitmap"
							          , ".xhtml"   : "application/xhtml+xml"
							          , ".xls"   : "application/vnd.ms-excel"
							          , ".xml"   : "application/xml"
							          , ".xpm"   : "image/x-xpixmap"
							          , ".xsl"   : "application/xml"
							          , ".xslt"  : "application/xslt+xml"
							          , ".yaml"  : "text/yaml"
							          , ".yml"   : "text/yaml"
							          , ".zip"   : "application/zip"
							          }, 
			  'BROWSER_PLAYER_EXTENSIONS' : ['.jpg', '.gif', '.png', '.tif', '.apk', '.txt', '.html'], # These are things that only play in the browser
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
	VERSION_TAG = 'ces2011-r7-b20-' + datetime.datetime.now().isoformat()
	VERSION_DESC = """
	ISANDROID = False
	<P>Fixed breakage from CES, and change handling of rpc to properly return a JSON response.  JSONFIY tool for 
	CherryPy doesn't really work well.  I'd like to get rid of CherryPy.  Implement pingheartbeat command.
	Implement basic functionality in launchurl to call into getbesturlpath to check the local cache for content.
	Fix some bad stuff in getbesturlpath.  Added ISANDROID.  Fix broken notification.  Sync works now.
	Finished killplatformplayer.  Bug fixes on launchviewer.  Added a few more players to the list.
	Added threaded sync BackgroundSync so that we background the request.  Haven't sorted out how to handle 
	callback to notify the teacher sync is done, but we might be able to fake it till we make it.  Reactivate 
	teacher control monitor to send student back to classroom.  Added bug fixes for launchurl bugs.  Added players 
	to player list.  Fix for endplayer, launch browser class.  Added handler for syncack callback.  Turn on MCP Loop.
	Fix typo bug in urllib2.  Added reads/writes for sync on smaller, configurable number of bytes, currently 1024.  
	Added droid reader to list of players.
	</P>
	"""
	# XXX Cleanup this duplicate config code, move it into global MCP_CONFIG
	PACKAGE_BLACKLIST = ['com.android.browser', # Android Browser
						'com.android.launcher', # The Dock Launcher
						'com.android.settings', # Settings
						]
	PACKAGE_RESTORELIST = []
	PACKAGE_PLAYERLIST = ['com.android.camera', # The Android Camera
						'com.android.videoplayer', # Android Video Player
						'com.android.providers.media', # Not really sure what this is, I think it is the video player backend
						'com.android.music', # The Android Music Player, NEED PDF VIEWER, Documents 2 Go, Text Viewer
						'com.android.gallery', # Image gallery?
						'de.hilses.droidreader', # Our chosen PDF Viewer
						]
	def __init__(self):
		try:
			self.droid = android.Android()
		except:
			print 'Exception initializing Android'
		self.ISANDROID = os.path.exists('/system/lib/libandroid_runtime.so') 
		print 'MCPService init completed'
		# XXX Put t into a shutdown hook so it gets stopped or canceled
		self.t = threading.Timer(10.0, mcploop).start()
		
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
	def testjson2(self):
		cherrypy.response.headers['Content-Type']= 'applications/json'
		jsonResp = {'foo': 1, 'bar': 'b'}
		return json.dumps(jsonResp)

	@cherrypy.expose
	def about(self):
		return """Version Tag: %s, Changes:%s"""%(self.VERSION_TAG, self.VERSION_DESC)
	
	@cherrypy.tools.jsonify()
	def getrange(self, limit=4):
	    return range(int(limit))
	getrange.exposed = True
	
	@cherrypy.expose
	def testnotify(self, **params):
		self.notifyUser('One Argument')
		self.notifyUser('Two Arguments', 'Title Arg')
		return 'ok'
		
	@cherrypy.expose
	# Test in a browser : http://localhost:8080/contentsyncpull?channel=foo3&jsoncallback=?
	def contentsyncpull(self, **params):
		print params
		channel = params['channel']
		jsoncallback = params['jsoncallback']
		results = []
		fileExtList = MCP_CONFIG['VALID_FILE_EXTENSIONS']
		channelpath = None
		contentrepourl = None
		# XXX Need a better way to test droidness
		try:
			self.droid = android.Android()
			channelpath = MCP_CONFIG['ANDROID_CONTENT_PATH'] + '/' + channel
			contentrepourl = MCP_CONFIG['CONTENT_REPO_LOCAL_URL']
		except:
			channelpath = MCP_CONFIG['DESKTOP_CONTENT_PATH'] + '/' + channel
			contentrepourl = 'file://'
		
			 
		if channel is not None:
			print "/contentsyncpull received request for channel " + channel
			print "using path " + channelpath + " to find content with these extensions: " + json.dumps(fileExtList)
			results = self.getlocalcontentsyncurl(channelpath, contentrepourl, fileExtList)
		else:
			print "/contentsyncpull didn't receive channel parameter, no content to return"
		# Dummy fixture
		# results = ["http://192.168.1.148:5000/content/foo/1.jpg","http://192.168.1.148:5000/content/foo/108942.jpg","http://192.168.1.148:5000/content/foo/116136642_1a928c013a.jpg","http://192.168.1.148:5000/content/foo/2.jpg","http://192.168.1.148:5000/content/foo/2010-09-29%2016.58.08.jpg","http://192.168.1.148:5000/content/foo/251_rhode_island_floorplan-1.jpg","http://192.168.1.148:5000/content/foo/251_rhode_island_floorplan-2.jpg","http://192.168.1.148:5000/content/foo/251_rhode_island_floorplan.jpg","http://192.168.1.148:5000/content/foo/25938_PE103626_S4.jpg","http://192.168.1.148:5000/content/foo/310.jpg","http://192.168.1.148:5000/content/foo/3946055_f67b05180b_o.jpg","http://192.168.1.148:5000/content/foo/6a4a64a35510f0e8.jpg","http://192.168.1.148:5000/content/foo/72970129_fa08a7a531.jpg","http://192.168.1.148:5000/content/foo/98993461_593c72d2dc_o.jpg"]
		jsonResp = json.dumps({'resultsCount' : len(results), 'results': results})
		return jsoncallback + '(' + jsonResp + ');'
		
	# 	@cherrypy.tools.validate_rpc()
	@cherrypy.expose
	# @cherrypy.tools.jsonify()
	# def rpc(self, apdu, ticketid, to, requestoruri, launchurl="None", sync="None", kill="None"):
	def rpc(self, **params):
		dataLength = int(cherrypy.request.headers.get('Content-Length') or 0)
		data = {}
		cherrypy.response.headers['Content-Type']= 'applications/json'
		jsoncallback = params['jsoncallback']
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
			jsonResp = self.launchurl(params['launchurl'], jsonResp)
		if apdu == '2':
			print 'sync value is ' + params['sync']
			# Old version, synchronous... takes too long :(, can fix this in 2.3 by using DOWNLOAD MANAGER
			# jsonResp = self.syncContent(params['sync'], jsonResp)
			BackgroundSync(params['sync'], self, params['syncnick']).start()
			jsonResp['status'] = 0 # Sync is now backgrounded
		if apdu == '3':
			jsonResp = self.kill(kill, jsonResp)
		if apdu == '4':
			jsonResp = self.mcpmodestart(jsonResp)
		if apdu == '5':
			jsonResp = self.mcpmodestop(jsonResp)
		if apdu == '6':
			pass
		if apdu == '7': # Heartbeat
			jsonResp = self.pingHeartbeat(jsonResp)
		if apdu == '8':
			jsonResp = self.killplatformplayer(jsonResp)
		jsonResp = self.prepareResponse(jsonReq, jsonResp)
		print json.dumps(jsonResp)
		# return json.dumps(jsonResp);
		return jsoncallback + '(' + json.dumps(jsonResp) + ')'
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
	def launchurl(self, aurl, rsp):
		if aurl is None: rsp.status = -1
		amime = None
		# Get the best url path
		aurl = self.getbesturlpath(aurl)
		print 'launchurl is opening best url path ' + aurl
		
		if aurl is None or aurl.startswith('http://'):
			rsp['status'] = 1 # Launch in the browser since no URL is bad, and URL is also bad for some reason
			return rsp
			
		try:
			amime = MCP_CONFIG['VALID_MIME_TYPES'][aurl[aurl.rindex('.'):]]
		except KeyError, e:
			pass
		if amime is not None:
			try:
				self.notifyUser("droid view launched with url" + aurl + " and mime = " + amime)
				self.droid.startActivity(MCP_CONFIG['ANDROID_VIEW_ACTIVITY'], aurl, amime, None, False)
			except:
				webbrowser.open(aurl)
			print "droid view launched with url " + aurl + ' and mime = ' + amime
			rsp['status'] = 0
		else:
			print "can't launch a url without a mime type ... to unpredictable in SL4A"
			rsp['status'] = -1
		return rsp
	#
	# XXX Depricated now ... use BackGroundSync
	#
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
			apath = self.ANDROID_CONTENT_PATH + '/' + urls.split('/')[-2] 
			dpath = self.DESKTOP_CONTENT_PATH + '/' + urls.split('/')[-2]
			filename = urls.split('/')[-1]
			if (not os.path.exists(apath + '/' + filename)) or (not os.path.exists(dpath + '/' + filename)):
				webFile = urllib.urlopen(urls)
				
				if not os.path.exists(apath):
					try:
						os.makedirs(apath)
					except OSError, e:
						print "may not be on android, could not create path " + apath + ", trying local path " + dpath
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
					try:
						self.notifyUser("Completed sync of " + filename + " to sd card.", "Teacher Content Synched")
					except:
						print "Completed sync of " + filename + " to sd card."
				except IOError, e:
					print 'error storing to ' + apath
				webFile.close()
				localFile.close()
			else:
				print 'url ' + urls + ' already synced to device'
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
		self.killpackage(uri)
		rsp['status'] = 0;
		return rsp
		
	def killplatformplayer(self, rsp):
		try:
			title = "Teacher stopping current Content Player"
			message = "Stopping the player in several moments.  Please be patient.  If the player does not step, please hit the back button twice to rejoin your class."
			# Showing a dialog puts the current activity in the "Visible" state but it is no longer front center
			self.droid.dialogCreateSpinnerProgress(title, message)
			self.droid.dialogShow()
			# Launching the Browser should put the user back into the current page where we left off
			self.droid.launch('com.android.browser.BrowserActivity') # XXX Hardcoded, put into config
		except:
			pass
		# XXX This doesn't seem to actually work ... should we just skip it?
		for pkg in self.PACKAGE_PLAYERLIST:
			self.killpackage(pkg)
			self.droid.dialogDismiss()
		rsp['status'] = 0;
		return rsp
		
	def pingHeartbeat(self, rsp):
		print "received pingHeartbeat"
		rsp['status'] = 0;
		rsp['version'] = self.VERSION_TAG
		return rsp
		
	def mcpmodestart(self, rsp):
		# XXX Put in list of packages to kill
		# check if we can get a list of running activities
		# Also, is there a way to disable the system softkeys (HOME, MENU, Back)
		# 
		print "mcpmodestart invoked"
		mcpmodetoggle = 1
		for packagename in self.PACKAGE_BLACKLIST:
			self.kill(packagename, rsp)
			self.PACKAGE_RESTORELIST.append(packagename) # Save these to restore later
		rsp['status'] = 0;
		self.notifyUser("Starting Teacher Control Mode")
		return rsp
	
	def mcpmodestop(self, rsp):
		# XXX Add code to relaunch killed apps
		print "mcpmodestop invoked"
		mcpmodetoggle = False
		for packagename in self.PACKAGE_RESTORELIST:
			print "attempting to restore " + packagename
		rsp['status'] = 0;
		self.notifyUser("Ending Teacher Control Mode")
		return rsp
	
	#
	# MCP Utility Methods
	# 
	def killpackage(self, uri):
		try:
			self.droid.forceStopPackage(uri) # Does this have return value?
			self.notifyUser('Teacher closed applicaton ' + uri)
		except:
			print "pretending to kill " + uri

	def notifyUser(self, message, title=None):
		if self.ISANDROID:
			print 'notifyUser ISANDROID'
			if self.droid is None:
				try:
					self.droid = Android.android()
				except:
					print "Couldn't create Android.android()"
					return
			self.droid.makeToast(message)
			self.droid.ttsSpeak(message)
			if title is not None:
				self.droid.notify(title, message)
		else:
			print 'notifyUser NOT ISANDROID'
			print message
		

	def getbesturlpath(self, uri):
		besturi = uri
		channel = uri.split('/')[-2]
		fileExtList = MCP_CONFIG['VALID_FILE_EXTENSIONS']
		filename = uri[uri.rindex('/') + 1:]
		
		# Check if this only plays in the browser, if so, just let the browser handle it
		for ext in MCP_CONFIG['BROWSER_PLAYER_EXTENSIONS']:
			if filename.endswith(ext):
				return None
		if channel is not None:
			if self.ISANDROID:
				channelpath = MCP_CONFIG['ANDROID_CONTENT_PATH'] + '/' + channel
				contentrepourl = "" # XXX For launching activity, just use a local path to sdcard
			else:
				channelpath = MCP_CONFIG['DESKTOP_CONTENT_PATH'] + '/' + channel
				contentrepourl = 'file://'
			print "/getbesturlpath received request for channel " + channel
			print "using path " + channelpath + " to find a content with these extensions: " + json.dumps(fileExtList)
			
			# Check to see if the filename matches anything in the ext list, if so, it is a valid file
			
			isafile = False
			for ext in fileExtList:
				if filename.endswith(ext):
					isafile = True
			if isafile:
				besturi = uri
				# Get the list of files for this channel
				results = self.getlocalcontentsyncurl(channelpath, contentrepourl, fileExtList)
				for f in results:
					if (f[f.rindex('/') + 1:] == filename):
						besturi = f
		else:
			print "/getbesturlpath didn't receive channel parameter, just use URL as is"
			besturi = uri
		return besturi	
			
			
	def getlocalcontentsyncurl(self, channelpath, contentrepourl, fileExtList):
		filelist = [] 
		try: 
			filelist = os.listdir(channelpath)
		except:
			print "path " + channelpath + " does not exist.  No synced content"
		urllist = []
		
		for f in filelist:
			if os.path.isfile(os.path.join(channelpath, f)) and os.path.splitext(f)[1] in fileExtList:
				urllist.append(contentrepourl + channelpath + "/" + f)
		return urllist

# def togglemcpmode():
#	if mcpmodetoggle == 0:
#		mcpmodetoggle = 1
#		return True
#	else:
#		mcpmodetoggle = 0
#		return False
def ismcpmodeon():
	if mcpmodetoggle == 0:
		return False
	else:
		return True

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
		print ismcpmodeon
		if ismcpmodeon:
			print "mcpmode is on"
			if droid is not None:
				print "checking if launcher is running"
				pkgs = droid.getRunningPackages()[1] # XXX ugly ... 
				if 'com.android.launcher' in pkgs:
					droid.makeToast("Teacher's Assistant sending user back to class")
					droid.ttsSpeak("Please return to class")
					droid.forceStopPackage('com.android.launcher')
					droid.startActivity(MCP_CONFIG['ANDROID_VIEW_ACTIVITY'], MCP_CONFIG['MCP_SERVER_ADDRESS'][0] + MCP_CONFIG['STUDENT_ENDPOINT'] , None, None, False)
			else:
				print "ta says get back to class"
		loopcount = loopcount + 1
		time.sleep(tickinterval)
			
def mcpServiceConnector():
	# svc = MCPService()
	# droid = svc.droid
	droid = None
	try:
		droid = android.Android()
	except:
		print "running in desktop mode"
	mcpconnectorurl = MCP_CONFIG['MCP_SERVER_ADDRESS'][0] + MCP_CONFIG['STUDENT_ENDPOINT']
	
	try:
		droid.makeToast('Launcing MCP service connector: ' + mcpconnectorurl)	
		droid.startActivity(MCP_CONFIG['ANDROID_VIEW_ACTIVITY'], mcpconnectorurl, None, None, False) # Nonblocking
	except:
		print "opening " + mcpconnectorurl
		webbrowser.open(mcpconnectorurl)
	print "MCP Service Version:%s"%(MCPService.VERSION_TAG)
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
	cherrypy.engine.block()

if __name__ == '__main__':
    run()