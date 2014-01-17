#!/bin/bash

# Android Screenshot Library #
##############################
#       Startup script       #

echo "Android Screenshot Library -- initializing..."
#
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
	
	# Install service
	echo "starting..."
	# $adb push ./asl-native /data/local/tmp/screencaploop.sh
	# $adb shell /system/bin/chmod 0777 /data/local/tmp/screencaploop.sh
	
	# Start the service
	# $adb shell "/data/local/tmp/screencaploop.sh /data/local/tmp/screencaploop.sh.log" &
	adb shell "mkdir -p /mnt/sdcard/sl4a/scripts/mcpfeeds"
	adb shell "while [ 1 ]; do /system/bin/screencap -p /mnt/sdcard/sl4a/scripts/mcpfeeds/screen-1.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/sl4a/scripts/mcpfeeds/screen-2.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/sl4a/scripts/mcpfeeds/screen-3.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/sl4a/scripts/mcpfeeds/screen-4.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/sl4a/scripts/mcpfeeds/screen-5.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/sl4a/scripts/mcpfeeds/screen-6.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/sl4a/scripts/mcpfeeds/screen-7.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/sl4a/scripts/mcpfeeds/screen-8.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/sl4a/scripts/mcpfeeds/screen-9.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/sl4a/scripts/mcpfeeds/screen-10.png; sleep 1; done &" &

	echo "Service started successfully."
fi