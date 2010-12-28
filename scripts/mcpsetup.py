import android
import urllib
import zipfile, os

"""File downloading from the web.
"""

file = "cherrypy.zip"
url = "https://rage.s3.amazonaws.com/" + file

def download(url):
	"""Copy the contents of a file from a given URL
	to a local file.
	"""
	webFile = urllib.urlopen(url)
	localFile = open(url.split('/')[-1], 'w')
	localFile.write(webFile.read())
	webFile.close()
	localFile.close()

def unzip_file_into_dir(file):
    zfobj = zipfile.ZipFile(file)
    for name in zfobj.namelist():
        if name.endswith('/'):
            os.mkdir(name)
        else:
            outfile = open(name, 'wb')
            outfile.write(zfobj.read(name))
            outfile.close()

def install_apk():
    apk_url = 'http://zxing.googlecode.com/files/BarcodeScanner3.53b1.apk'
    apk_type = 'application/vnd.android.package-archive' # For some reason, this causes a crash, so don't use it
    droid.view(apk_url)

if __name__ == '__main__':
    droid = android.Android()

    try:
	download(url)
	unzip_file_into_dir(file)
 	install_apk()	
    except IOError:
	print 'Error'
