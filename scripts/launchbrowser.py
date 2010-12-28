"""
	Simple example to launch the browser.

	for this example, we import android.  That gives us all of the 
	APIs available: http://code.google.com/p/android-scripting/wiki/ApiReference

	The api we want to use is the view() api.  This takes just a URL and 
	optionally a MIME type.  This is good.  That's what we want!  

	For our purposes, we don't need a fully object oriented structure quite yet.
	We just want to demonstrate the functionality works.  This is how I would
	go about rapid prototyping the working MCP.  Each script should not be 
	very long and it will handle just the request.  I'll work this example
	into the web server, and maybe you can finish it off by testing.
	
	You are free to import and use other PYTHON libraries supported by 
	python 2.6.  However, be aware that these libraries won't necessarily 
	all have perfect integration into the android platform.  Use what you need.
"""

__author__ = 'dkords@razortooth.biz'
__copyright__ = 'Razortooth Communications, LL'
__license__ = 'proprietary'

import android

droid = android.Android()
url1 = 'http://www.news.com'
type1 = 'text/html'

droid.view(url1, type1);
