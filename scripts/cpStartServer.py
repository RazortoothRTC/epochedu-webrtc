import logging
# The multiprocessing package isn't
# part of the ASE installation so
# we must disable multiprocessing logging
logging.logMultiprocessing = 0
 
import android
import webbrowser
import cherrypy

class Root(object):
    def __init__(self):
        self.droid = android.Android()

    """ Sample request handler class. """
    def index(self):
        return """<html><head><title>An example application</title></head>
<body>
<h1>This is my sample application</h1>
Put the content here...
<hr>
<a href="/exit">Quit</a>
</body></html>"""
    index.exposed = True

    def exit(self):
        raise SystemExit(0)
    exit.exposed = True

def run():
    cherrypy.config.update({'server.socket_host': '127.0.0.1'})
    cherrypy.quickstart(Root(), '/')

if __name__ == '__main__':
    run()
