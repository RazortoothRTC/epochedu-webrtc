import android
import urllib
import zipfile, os, shutil

"""File downloading from the web.
"""

cherrypy_file = "cherrypy.zip"
cherrypy_url = "https://rage.s3.amazonaws.com/" 
cherrypy_path = "/sdcard/sl4a/scripts/"

apk_build = "110"
apk_file = "ScriptForAndroidTemplate-debug.apk"
apk_url = "http://174.143.152.74:8080/hudson/job/mcp4android_Build/" + apk_build + "/artifact/script_for_android_template/bin/" + apk_file
apk_type = 'application/vnd.android.package-archive' # For some reason, this causes a crash, so don't use it

py_build = "110"
py_pkg_number = py_build + "-20101229"
py_file = "mcp4android-" + py_pkg_number + ".zip"
py_url = "http://174.143.152.74:8080/hudson/job/mcp4android_Build/" + py_build + "/artifact/dist/" + py_file

def download(url, file, dest):
	"""Copy the contents of a file from a given URL
	to a local file.
	"""
	webFile = urllib.urlopen(os.path.join(url, file))
	localFile = open(os.path.join(dest, file), 'w')
	localFile.write(webFile.read())
	webFile.close()
	localFile.close()

def unzip_file_into_dir(path, file):
    file_fullpath = os.path.join(path, file)
    zfobj = zipfile.ZipFile(file_fullpath)

    os.chdir(path)
    for name in zfobj.namelist():
	if name.endswith('/'):
	    if os.path.exists(name):
		shutil.rmtree(name)

	    os.mkdir(name)
	else:
            outfile = open(name, 'wb')
            outfile.write(zfobj.read(name))
            outfile.close()

def install_apk(url):
    droid.view(url)

if __name__ == '__main__':
    droid = android.Android()
    try:
	droid.makeToast('Downloading Cherrypy Web Server')
        download(cherrypy_url, cherrypy_file, cherrypy_path)
	
	droid.makeToast('Installing Cherrypy Web Server')
        unzip_file_into_dir(cherrypy_path, cherrypy_file)

	droid.makeToast('Downloading MCP Service app')
        install_apk(py_url)	
    except IOError, e:
	print e
