#!/usr/bin/env python
# encoding: utf-8
"""
mcpta.py

Created by David J. Kordsmeier on 2011-01-02.
Copyright (c) 2011 Razortooth Communications, LLC. All rights reserved.

This is a hack just because I couldn't get cherrypy to do anything else but be a webserver
Periodic processing wouldn't seem to work
"""

import sys
import os
import time
import android

INTERVAL = 30 # seconds between sleeps
MCP_SERVER_URI = ['http://192.168.1.148:5000/student'] # XXX DEMOSETTINGS
def main():
	droid = android.Android()
	while True:
		time.sleep(0.3)
		print "MCP Teachers Assistant is waking up to check on you"
		pkgs = droid.getRunningPackages()[1] # XXX ugly ... 
		if 'com.android.launcher' in pkgs:
			droid.makeToast("Teacher's Assistant sending user back to class")
			droid.forceStopPackage('com.android.launcher')
			droid.view(MCP_SERVER_URI[0], "text/html")
		time.sleep(INTERVAL)


if __name__ == '__main__':
	main()

