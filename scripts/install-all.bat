@echo off

echo Installing EpochEDU support APKs for Android

if not defined ANDROID goto SdkPathNotDefined

echo Waiting for device to be connected...
%ANDROID%\platform-tools\adb.exe wait-for-device

echo - Installing Mozilla apk ...
%ANDROID%\platform-tools\adb.exe install ../android/fennec-29.0a1.multi.android-arm.apk

echo - Installing OI File Manager apk ...
%ANDROID%\platform-tools\adb.exe install ../android/FileManager-2.0.2.apk

echo - Installing EpochWatchdog apk ...
%ANDROID%\platform-tools\adb.exe install ../android/EpochWatchdog-debug.apk

echo - Installing sl4a apk ...
%ANDROID%\platform-tools\adb.exe install ../android/sl4a_r6.apk

echo - Installing SMILE Teacher apk ...
%ANDROID%\platform-tools\adb.exe install ../android/SMILETeacher-debug.apk

REM Unfortunately, we need to install the python part manually
REM echo - Installing sl4a python apk ...
REM %ANDROID%\platform-tools\adb.exe install ../android/PythonForAndroid_r4.apk

echo - Installing cherrypy for sl4a
%ANDROID%\platform-tools\adb.exe push ./cherrypy /mnt/sdcard/sl4a/scripts/cherrypy

echo - Installing mcpservice.py for sl4a
%ANDROID%\platform-tools\adb.exe push ./mcpservice.py /mnt/sdcard/sl4a/scripts/mcpservice.py

echo - Installing demoreset.py for sl4a
%ANDROID%\platform-tools\adb.exe push ./demoreset.py /mnt/sdcard/sl4a/scripts/demoreset.py

goto Finish
                                                                                                                                                                                                                                                                                                                     
:SdkPathNotDefined
echo *** Android SDK not found ***
echo Make sure ANDROID variable is set to root folder of Android SDK.

:Finish