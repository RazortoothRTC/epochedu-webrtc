"""
	Reset demo by cleaning up contents of /sdcard.

"""

__author__ = 'dkords@razortooth.biz'
__copyright__ = 'Razortooth Communications, LL'
__license__ = 'proprietary'

import android
import os
import shutil

droid = android.Android()
title = "Resetting EpochEDU Demo"
message = "Deleting Cached content on SDCard.  Please be patient while we clean up."
contentcache = '/mnt/sdcard/content'
droid.dialogCreateSpinnerProgress(title, message)
droid.dialogShow()

try:
	contentdirs = os.listdir(contentcache)

	for dir in contentdirs:
		try:
			shutil.rmtree(os.path.join(contentcache,dir))
		except:
			print "No cached content to remove in " + os.path.join(contentcache,dir)
except:
	print "No cached content directory " + contentcache
droid.dialogDismiss()