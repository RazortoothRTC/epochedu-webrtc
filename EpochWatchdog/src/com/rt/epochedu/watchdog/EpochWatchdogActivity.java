package com.rt.epochedu.watchdog;

import android.app.Activity;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.widget.Toast;
import android.content.Context;
import android.content.Intent;
import android.content.res.Resources;
import android.content.pm.PackageManager.NameNotFoundException;
import android.content.pm.PackageManager;
import android.content.ComponentName;
import android.util.Log;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.content.ComponentName;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.StrictMode;


import java.io.BufferedWriter;
import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;
import java.io.File;
import java.io.FileWriter;
import java.util.Date;
import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;
import java.io.FilenameFilter;
import java.util.Arrays;
import java.util.Comparator;
import java.io.FileOutputStream;
import java.io.FileNotFoundException;

public class EpochWatchdogActivity extends Activity
{
	private static final boolean DEVELOPER_MODE = true;
	public static final String TAG = "EpochWatchdog";
	private PackageManager mPackageManager;
	private ComponentName mLauncherComponent;
	private ComponentName mThisComponent;
	private static final String MCPFEEDS_SCREENSHOT_PATH = "/mnt/sdcard/sl4a/scripts/mcpfeeds"; // XXX Don't assume this path works on all devices
	private static final String SCREENGRAB_PREFIX = "screen-";
	private static final String THUMBNAIL_48X48 = "thumb48x48.png";
	private static final int THUMBNAIL_WIDTH_DEFAULT = 48;
	private static final int THUMBNAIL_HEIGHT_DEFAULT = 48;
	private static ScheduledExecutorService mScheduledChatWorkerTaskExecutor;

    /** Called when the activity is first created. */
    @Override
    public void onCreate(Bundle savedInstanceState)
    {
    	if (DEVELOPER_MODE) {
			StrictMode.setThreadPolicy(new StrictMode.ThreadPolicy.Builder()
			     .detectDiskReads()
			     .detectDiskWrites()
			     .detectNetwork()   // or .detectAll() for all detectable problems
			     .penaltyLog()
			     .build());
			StrictMode.setVmPolicy(new StrictMode.VmPolicy.Builder()
			     .detectLeakedSqlLiteObjects()
			     .detectLeakedClosableObjects()
			     .penaltyLog()
			     .penaltyDeath()
			     .build());
		}

        super.onCreate(savedInstanceState);
        setContentView(R.layout.main);

        mLauncherComponent = new ComponentName("com.android.launcher", "Launcher");
        mThisComponent = getComponentName();
        mPackageManager = this.getPackageManager();
        mScheduledChatWorkerTaskExecutor = Executors.newScheduledThreadPool(2);
        
        mScheduledChatWorkerTaskExecutor.scheduleAtFixedRate(new Runnable() {
        	int count = 0;
			public void run() {
				Log.d(TAG, "SMILE, capturing the screen");
				// executeShellCommand("su -c 'ls -l' root");
				// executeShellCommand("/system/bin/screenshot /mnt/sdcard/sl4a/scripts/mcpfeeds/foo2.png");
				// executeShellCommand("su -c /system/bin/screenshot /mnt/sdcard/sl4a/scripts/mcpfeeds/screengrab-" + count + ".png");
				// executeShellCommand("su - root && /system/bin/screenshot /mnt/sdcard/sl4a/scripts/mcpfeeds/foo3.png");
				executeShellCommand("su -c busybox /system/bin/screenshot /mnt/sdcard/sl4a/scripts/mcpfeeds/foo3.png");
				// executeShellCommand("su -c /system/bin/screencap -p /mnt/sdcard/sl4a/scripts/mcpfeeds/screengrab-" + count + ".png");
				// executeShellCommand("su -c '/system/bin/screencap -p /mnt/sdcard/sl4a/scripts/mcpfeeds/screengrab-" + count + ".png' root");
				// executeShellCommand("/system/bin/screencap -p /mnt/sdcard/sl4a/scripts/mcpfeeds/screengrab-" + count + ".png");
				count++;
				if (count == 10) {
					count = 0;
				}
			}
		}, 1000L, 10000L,  TimeUnit.MILLISECONDS);

        mScheduledChatWorkerTaskExecutor.scheduleAtFixedRate(new Runnable() {
			public void run() {
				Log.d(TAG, "Transform Bitmap into thumbnail");
				Bitmap latestBMP;
				File[] screengrabs = getSortedScreengrabFiles();

				//
				// Take the most recent image
				// And take the latest file, load it, and make a bmp
				// and save it
				if (screengrabs.length > 0) {
					File sgfile = screengrabs[0];
					Bitmap sgbmp = BitmapFactory.decodeFile(sgfile.getPath());
					Bitmap thumbbmp = Bitmap.createScaledBitmap(sgbmp, THUMBNAIL_WIDTH_DEFAULT, THUMBNAIL_HEIGHT_DEFAULT, false);
					File thumbf = new File(MCPFEEDS_SCREENSHOT_PATH + "/" + THUMBNAIL_48X48);
					FileOutputStream fout  = null;
					// XXX This all can fail if we don't have write access
					try {
    					fout = new FileOutputStream(thumbf);
    					thumbbmp.compress(Bitmap.CompressFormat.PNG, 93, fout);
    					fout.flush();
    				} catch(FileNotFoundException fnfe) {
    					Log.e(TAG, "Unable to write out thumbnail, reason, " + fnfe.getMessage());
    					// XXX We should visually report the error
    				} catch(IOException ioe) {
    					Log.e(TAG, "Error writing out thumb because: " + ioe.getMessage());
    				}finally {
    					if (fout != null) {
    						try {
    							fout.close();
    						} catch(IOException ioe) {

    						}
    					}
    				}
				}

				//
				// XXX Print this for debug purposes
				//
				Log.d(TAG, "Dumping screengrabs length = " + screengrabs.length);
				for (int i = 0; i < screengrabs.length; i++) {
					Log.d(TAG, "File: " + screengrabs[i].getName() + " createDate = " + new Date(screengrabs[i].lastModified()) + " length = " + screengrabs[i].length());
				}

			}
		}, 30000, 30000, TimeUnit.MILLISECONDS); // XXX Hardcoded values 

        // mPackageManager.setComponentEnabledSetting (ComponentName componentName, int newState, int flags);
    	// mPackageManager.setComponentEnabledSetting(mThisComponent, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        // mPackageManager.setComponentEnabledSetting(mLauncherComponent, PackageManager.COMPONENT_ENABLED_STATE_DISABLED, 0);
    }

    @Override
    protected void onPause() {
        super.onPause();
        // mPackageManager.setComponentEnabledSetting(mThisComponent, PackageManager.COMPONENT_ENABLED_STATE_DISABLED, 0);
        // mPackageManager.setComponentEnabledSetting(mLauncherComponent, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, 0);
    }

    /*
    @Override
    public void onAttachedToWindow() {
    	super.onAttachedToWindow();
    	this.getWindow().setType(WindowManager.LayoutParams.TYPE_KEYGUARD);
	}
	*/
	
	@Override
	public boolean onKeyDown(int keyCode, KeyEvent event) {
	    if(keyCode==KeyEvent.KEYCODE_HOME)
	    {
	    	Log.d(TAG, "HOME HIT");
	        Intent homeIntent = new Intent(Intent.ACTION_MAIN);
	        homeIntent.addCategory(Intent.CATEGORY_HOME);
	        homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
	        startActivity(homeIntent);
	        Toast.makeText(getApplicationContext(), "home", 1).show();
	        Timer t = new Timer();
	        t.schedule(new TimerTask() {
	            @Override
	            public void run() {
	                Intent dialogIntent = new Intent(getBaseContext(), EpochWatchdogActivity.class);
	    			dialogIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
	    			getApplication().startActivity(dialogIntent);
	            }
	        }, 5000);
	    }
	    return super.onKeyDown(keyCode, event);
	}

	public static File[] getSortedScreengrabFiles() {
		File sdpath = new File(MCPFEEDS_SCREENSHOT_PATH);
		// File selectedFile = null;

		if (sdpath.exists()) {
			FilenameFilter filter = new FilenameFilter() {
		        @Override
		        public boolean accept(File dir, String filename) {
		          File fqpath = new File(dir, filename);
		          // Filters based on whether the file is hidden or not
		          return (fqpath.isFile() &&
		              fqpath.getName().toLowerCase().endsWith(".png")  && filename.startsWith(SCREENGRAB_PREFIX) &&
		              (fqpath.length() > 0));
		        }
			};

			File[] sortedFiles = sdpath.listFiles(filter);
			Arrays.sort(sortedFiles, new Comparator() {
		          public int compare(Object o1, Object o2) {

		              // Sort descending
		              if (((File)o1).lastModified() > ((File)o2).lastModified()) {
		                  return -1;
		              } else if (((File)o1).lastModified() < ((File)o2).lastModified()) {
		                  return +1;
		              } else {
		                  return 0;
		              }
		          }
			});
			return sortedFiles;
		} else {
			return null;
		}
	}

	private boolean executeShellCommand(String command){
	    Process process = null;

	    try{

	        process = Runtime.getRuntime().exec(command);
	    	/* process = new ProcessBuilder()
       			.command(command)
       			.redirectErrorStream(true)
       			.start(); */

	        BufferedReader reader = new BufferedReader(
		            new InputStreamReader(process.getErrorStream()));
		    int read;
		    char[] buffer = new char[4096];
		    StringBuffer output = new StringBuffer();
		    while ((read = reader.read(buffer)) > 0) {
		        output.append(buffer, 0, read);
		    }
		    reader.close();
		    
		    // Waits for the command to finish.
		    process.waitFor();

	        Log.d(TAG, "success exec-ing " + command);
	        Log.d(TAG, "stdout: " + output.toString());
	        return true;
	        
	    } catch (Exception e) {
	    	Log.e(TAG, "can't run command: " + e.getMessage());
	    	e.printStackTrace();
	        return false;
	    } finally{
	        if(process != null){
	        	/*
	            try{
	                process.destroy();
	            }catch (Exception e) {
	            	Log.e(TAG, "Error exec-ing a command: " + e.getMessage());
	            }
	            */
	        }
	    }
	}

}
