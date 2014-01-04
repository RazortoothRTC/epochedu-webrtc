@echo off

echo Android Screenshot Library -- Initializing...

if not defined ANDROID goto SdkPathNotDefined

echo Waiting for device to be connected...
%ANDROID%\platform-tools\adb.exe wait-for-device

echo - Installing native service...
%ANDROID%\platform-tools\adb.exe push ./screencaploop.sh /data/local/tmp/screencaploop.sh
%ANDROID%\platform-tools\adb.exe shell /system/bin/chmod 0777 /data/local/tmp/screencaploop.sh

echo Starting...

%ANDROID%\platform-tools\adb.exe shell kill -9 "/data/local/tmp/screencaploop.sh"
REM start /B %ANDROID%\platform-tools\adb.exe shell "sh /data/local/tmp/screencaploop.sh"
start /B %ANDROID%\platform-tools\adb.exe shell "while [ 1 ]; do /system/bin/screencap -p /mnt/sdcard/screen-1.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/screen-2.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/screen-3.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/screen-4.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/screen-5.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/screen-6.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/screen-7.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/screen-8.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/screen-9.png; sleep 1; /system/bin/screencap -p /mnt/sdcard/screen-10.png; sleep 1; done"
echo Service started successfully.


goto Finish
                                                                                                                                                                                                                                                                                                                     
:SdkPathNotDefined
echo *** Android SDK not found ***
echo Make sure ANDROID variable is set to root folder of Android SDK.

:Finish