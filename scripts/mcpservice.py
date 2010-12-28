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

class MCPService(object):
    def __init__(self):
        self.droid = android.Android()

    """ Sample request handler class. """
    def index(self):
        return """<html><head><title>An example application</title></head>
<body>
<h1>This is my sample application, Hello World!</h1>
Put the content here...
<hr>
<a href="/exit">Quit</a>
</body></html>"""
    index.exposed = True

    def exit(self):
        raise SystemExit(0)
    exit.exposed = True

def testviewcraigslist():
	aURL = 'http://craigslist.com'
	aMIME = 'text/html'
    droid.view(aURL, aMIME) 

def run():
    cherrypy.config.update({'cherrypy.server.socket_port':'8080'})
    cherrypy.config.update({'server.socket_host':'127.0.0.1'})
    cherrypy.quickstart(MCPService(), '/')
    cherrypy.engine.subscribe('start', browse, priority=90)
    cherrypy.engine.block()
    #os.system('python script.py')

if __name__ == '__main__':
    run()
