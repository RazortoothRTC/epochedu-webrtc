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
contentcache = '/sdcard/contents'
droid.dialogCreateSpinnerProgress(title, message)
droid.dialogShow()

contentdirs = os.listdir(contentcache)

for dir in contentdirs:
	shutil.rmtree(os.path.join(contentcache,dir))

droid.dialogDismiss()