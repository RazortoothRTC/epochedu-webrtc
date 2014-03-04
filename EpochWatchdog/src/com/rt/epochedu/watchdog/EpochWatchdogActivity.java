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

import java.io.BufferedWriter;
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


public class EpochWatchdogActivity extends Activity
{
	public static final String TAG = "EpochWatchdog";
	private PackageManager mPackageManager;
	private ComponentName mLauncherComponent;
	private ComponentName mThisComponent;
	private static final String MCPFEEDS_SCREENSHOT_PATH = "/mnt/sdcard/sl4a/scripts/mcpfeeds";
	private static ScheduledExecutorService mScheduledChatWorkerTaskExecutor;

    /** Called when the activity is first created. */
    @Override
    public void onCreate(Bundle savedInstanceState)
    {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.main);
        mLauncherComponent = new ComponentName("com.android.launcher", "Launcher");
        mThisComponent = getComponentName();
        mPackageManager = this.getPackageManager();
        mScheduledChatWorkerTaskExecutor = Executors.newScheduledThreadPool(1);
        mScheduledChatWorkerTaskExecutor.scheduleAtFixedRate(new Runnable() {
			public void run() {
				Log.d(TAG, "Transform Bitmap into thumbnail");
				Bitmap latestBMP;


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
		              fqpath.getName().toLowerCase().endsWith(".png")  && filename.startsWith("screengrab-"));
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

}
