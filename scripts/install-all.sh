#!/bin/sh

echo Installing EpochEDU support APKs for Android

if [ -z $ANDROID ]; then
	echo "*** Android SDK not found ***"
	echo "Make sure the ANDROID variable is pointing to Android SDK root directory"
else
	adb="$ANDROID/platform-tools/adb"
	
	# Check whether device is connected or wait for one
	adbState=`$adb get-state`
	if [ $adbState = "device" ]; then
		echo "Device not found -- connect one to continue..."
		$adb wait-for-device
		echo "Device connected."
	fi

	echo - Installing Mozilla apk ...
	$adb install ../android/fennec-29.0a1.multi.android-arm.apk

	echo - Installing OI File Manager apk ...
	$adb install ../android/FileManager-2.0.2.apk

	echo - Installing EpochWatchdog apk ...
	$adb install ../android/EpochWatchdog-debug.apk

	echo - Installing sl4a apk ...
	$adb install ../android/sl4a_r6.apk

	echo - Installing SMILE Teacher apk ...
	$adb install ../android/SMILETeacher-debug.apk

	REM Unfortunately, we need to install the python part manually
	REM echo - Installing sl4a python apk ...
	REM %ANDROID%\platform-tools\adb.exe install ../android/PythonForAndroid_r4.apk

	echo - Installing cherrypy for sl4a
	$adb push ./cherrypy /mnt/sdcard/sl4a/scripts/cherrypy

	echo - Installing mcpservice.py for sl4a
	$adb push ./mcpservice.py /mnt/sdcard/sl4a/scripts/mcpservice.py

	echo - Installing demoreset.py for sl4a
	$adb push ./demoreset.py /mnt/sdcard/sl4a/scripts/demoreset.py
fi