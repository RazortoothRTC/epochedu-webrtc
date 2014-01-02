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

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.File;
import java.io.FileWriter;
import java.util.Date;
import java.util.Timer;
import java.util.TimerTask;

public class EpochWatchdogActivity extends Activity
{
	public static final String TAG = "EPOCH";
	private PackageManager mPackageManager;
	private ComponentName mLauncherComponent;
	private ComponentName mThisComponent;

    /** Called when the activity is first created. */
    @Override
    public void onCreate(Bundle savedInstanceState)
    {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.main);
        mLauncherComponent = new ComponentName("com.android.launcher", "Launcher");
        mThisComponent = getComponentName();
        mPackageManager = this.getPackageManager();
        // mPackageManager.setComponentEnabledSetting (ComponentName componentName, int newState, int flags);
    	// mPackageManager.setComponentEnabledSetting(mThisComponent, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        mPackageManager.setComponentEnabledSetting(mLauncherComponent, PackageManager.COMPONENT_ENABLED_STATE_DISABLED, 0);
    }

    @Override
    protected void onPause() {
        super.onPause();
        mPackageManager.setComponentEnabledSetting(mThisComponent, PackageManager.COMPONENT_ENABLED_STATE_DISABLED, 0);
        mPackageManager.setComponentEnabledSetting(mLauncherComponent, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, 0);
    }

    @Override
    public void onAttachedToWindow() {
    	super.onAttachedToWindow();
    	this.getWindow().setType(WindowManager.LayoutParams.TYPE_KEYGUARD);
	}

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
}
