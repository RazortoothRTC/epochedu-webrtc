"""A library of helper functions for the CherryPy test suite."""

import datetime
from httplib import HTTPSConnection
import logging
log = logging.getLogger(__name__)
import os
thisdir = os.path.abspath(os.path.dirname(__file__))
serverpem = os.path.join(os.getcwd(), thisdir, 'test.pem')

import re
import sys
import time
import warnings

import cherrypy
from cherrypy.lib import httputil, profiler
from cherrypy.lib.reprconf import unrepr
from cherrypy.test import webtest

_testconfig = None

def get_tst_config(overconf = {}):
    global _testconfig
    if _testconfig is None:
        conf = {
            'scheme': 'http',
            'protocol': "HTTP/1.1",
            'port': 8080,
            'host': '127.0.0.1',
            'validate': False,
            'conquer': False,
        }
        try:
            import testconfig
            _conf = testconfig.config.get('supervisor', None)
            if _conf is not None:
                for k, v in _conf.iteritems():
                    if isinstance(v, basestring):
                        _conf[k] = unrepr(v)
                conf.update(_conf)
        except ImportError:
            pass
        _testconfig = conf
    conf = _testconfig.copy()
    conf.update(overconf)

    return conf

class Supervisor(object):
    """Base class for modeling and controlling servers during testing."""

    def __init__(self, **kwargs):
        for k, v in kwargs.iteritems():
            if k == 'port':
                setattr(self, k, int(v))
            setattr(self, k, v)


class LocalSupervisor(Supervisor):
    """Base class for modeling/controlling servers which run in the same process.

    When the server side runs in a different process, start/stop can dump all
    state between each test module easily. When the server side runs in the
    same process as the client, however, we have to do a bit more work to ensure
    config and mounted apps are reset between tests.
    """

    using_apache = False
    using_wsgi = False

    def __init__(self, **kwargs):
        for k, v in kwargs.iteritems():
            setattr(self, k, v)

        cherrypy.server.httpserver = self.httpserver_class

        engine = cherrypy.engine
        if hasattr(engine, "signal_handler"):
            engine.signal_handler.subscribe()
        if hasattr(engine, "console_control_handler"):
            engine.console_control_handler.subscribe()
        #engine.subscribe('log', lambda msg, level: sys.stderr.write(msg + os.linesep))

    def start(self, modulename=None):
        """Load and start the HTTP server."""
        if modulename:
            # Unhook httpserver so cherrypy.server.start() creates a new
            # one (with config from setup_server, if declared).
            cherrypy.server.httpserver = None

        cherrypy.engine.start()

        self.sync_apps()

    def sync_apps(self):
        """Tell the server about any apps which the setup functions mounted."""
        pass

    def stop(self):
        td = getattr(self, 'teardown', None)
        if td:
            td()
        cherrypy.engine.exit()


class NativeServerSupervisor(LocalSupervisor):
    """Server supervisor for the builtin HTTP server."""

    httpserver_class = "cherrypy._cpnative_server.CPHTTPServer"
    using_apache = False
    using_wsgi = False

    def __str__(self):
        return "Builtin HTTP Server on %s:%s" % (self.host, self.port)


class LocalWSGISupervisor(LocalSupervisor):
    """Server supervisor for the builtin WSGI server."""

    httpserver_class = "cherrypy._cpwsgi_server.CPWSGIServer"
    using_apache = False
    using_wsgi = True

    def __str__(self):
        return "Builtin WSGI Server on %s:%s" % (self.host, self.port)

    def sync_apps(self):
        """Hook a new WSGI app into the origin server."""
        cherrypy.server.httpserver.wsgi_app = self.get_app()

    def get_app(self):
        """Obtain a new (decorated) WSGI app to hook into the origin server."""
        app = cherrypy.tree
        if self.conquer:
            try:
                import wsgiconq
            except ImportError:
                warnings.warn("Error importing wsgiconq. pyconquer will not run.")
            else:
                app = wsgiconq.WSGILogger(app, c_calls=True)
        if self.validate:
            try:
                from wsgiref import validate
            except ImportError:
                warnings.warn("Error importing wsgiref. The validator will not run.")
            else:
                #wraps the app in the validator
                app = validate.validator(app)

        return app


def get_cpmodpy_supervisor(**options):
    from cherrypy.test import modpy
    sup = modpy.ModPythonSupervisor(**options)
    sup.template = modpy.conf_cpmodpy
    return sup

def get_modpygw_supervisor(**options):
    from cherrypy.test import modpy
    sup = modpy.ModPythonSupervisor(**options)
    sup.template = modpy.conf_modpython_gateway
    sup.using_wsgi = True
    return sup

def get_modwsgi_supervisor(**options):
    from cherrypy.test import modwsgi
    return modwsgi.ModWSGISupervisor(**options)

def get_modfcgid_supervisor(**options):
    from cherrypy.test import modfcgid
    return modfcgid.ModFCGISupervisor(**options)

def get_wsgi_u_supervisor(**options):
    cherrypy.server.wsgi_version = ('u', 0)
    return LocalWSGISupervisor(**options)


class CPWebCase(webtest.WebCase):
    script_name = ""
    scheme = "http"

    available_servers = {'wsgi': LocalWSGISupervisor,
                         'wsgi_u': get_wsgi_u_supervisor,
                         'native': NativeServerSupervisor,
                         'cpmodpy': get_cpmodpy_supervisor,
                         'modpygw': get_modpygw_supervisor,
                         'modwsgi': get_modwsgi_supervisor,
                         'modfcgid': get_modfcgid_supervisor,
                         }
    default_server = "wsgi"
    supervisor_factory = None

    @classmethod
    def _setup_server(cls, supervisor, conf):
        v = sys.version.split()[0]
        log.info("Python version used to run this test script: %s" % v)
        log.info("CherryPy version: %s" % cherrypy.__version__)
        if supervisor.scheme == "https":
            ssl = " (ssl)"
        else:
            ssl = ""
        log.info("HTTP server version: %s%s" % (supervisor.protocol, ssl))
        log.info("PID: %s" % os.getpid())

        cherrypy.server.using_apache = supervisor.using_apache
        cherrypy.server.using_wsgi = supervisor.using_wsgi

        if sys.platform[:4] == 'java':
            cherrypy.config.update({'server.nodelay': False})

        if isinstance(conf, basestring):
            parser = cherrypy.lib.reprconf.Parser()
            conf = parser.dict_from_file(conf).get('global', {})
        else:
            conf = conf or {}
        baseconf = conf.copy()
        baseconf.update({'server.socket_host': supervisor.host,
                         'server.socket_port': supervisor.port,
                         'server.protocol_version': supervisor.protocol,
                         'environment': "test_suite",
                         })
        if supervisor.scheme == "https":
            baseconf['server.ssl_certificate'] = serverpem
            baseconf['server.ssl_private_key'] = serverpem

        # helper must be imported lazily so the coverage tool
        # can run against module-level statements within cherrypy.
        # Also, we have to do "from cherrypy.test import helper",
        # exactly like each test module does, because a relative import
        # would stick a second instance of webtest in sys.modules,
        # and we wouldn't be able to globally override the port anymore.
        if supervisor.scheme == "https":
            webtest.WebCase.HTTP_CONN = HTTPSConnection
        return baseconf

    @classmethod
    def setup_class(cls):
        ''
        #Creates a server
        conf = get_tst_config()
        if not cls.supervisor_factory:
            cls.supervisor_factory = cls.available_servers.get(conf.get('server', 'wsgi'))
            if cls.supervisor_factory is None:
                raise RuntimeError('Unknown server in config: %s' % conf['server'])
        supervisor = cls.supervisor_factory(**conf)

        #Copied from "run_test_suite"
        cherrypy.config.reset()
        baseconf = cls._setup_server(supervisor, conf)
        cherrypy.config.update(baseconf)
        setup_client()

        if hasattr(cls, 'setup_server'):
            # Clear the cherrypy tree and clear the wsgi server so that
            # it can be updated with the new root
            cherrypy.tree = cherrypy._cptree.Tree()
            cherrypy.server.httpserver = None
            cls.setup_server()
            supervisor.start(cls.__module__)

        cls.supervisor = supervisor


    @classmethod
    def teardown_class(cls):
        ''
        if hasattr(cls, 'setup_server'):
            cls.supervisor.stop()

    def prefix(self):
        return self.script_name.rstrip("/")

    def base(self):
        if ((self.scheme == "http" and self.PORT == 80) or
            (self.scheme == "https" and self.PORT == 443)):
            port = ""
        else:
            port = ":%s" % self.PORT

        return "%s://%s%s%s" % (self.scheme, self.HOST, port,
                                self.script_name.rstrip("/"))

    def exit(self):
        sys.exit()

    def getPage(self, url, headers=None, method="GET", body=None, protocol=None):
        """Open the url. Return status, headers, body."""
        if self.script_name:
            url = httputil.urljoin(self.script_name, url)
        return webtest.WebCase.getPage(self, url, headers, method, body, protocol)

    def skip(self, msg='skipped '):
        sys.stderr.write(msg)

    def assertErrorPage(self, status, message=None, pattern=''):
        """Compare the response body with a built in error page.

        The function will optionally look for the regexp pattern,
        within the exception embedded in the error page."""

        # This will never contain a traceback
        page = cherrypy._cperror.get_error_page(status, message=message)

        # First, test the response body without checking the traceback.
        # Stick a match-all group (.*) in to grab the traceback.
        esc = re.escape
        epage = esc(page)
        epage = epage.replace(esc('<pre id="traceback"></pre>'),
                              esc('<pre id="traceback">') + '(.*)' + esc('</pre>'))
        m = re.match(epage, self.body, re.DOTALL)
        if not m:
            self._handlewebError('Error page does not match; expected:\n' + page)
            return

        # Now test the pattern against the traceback
        if pattern is None:
            # Special-case None to mean that there should be *no* traceback.
            if m and m.group(1):
                self._handlewebError('Error page contains traceback')
        else:
            if (m is None) or (
                not re.search(re.escape(pattern),
                              m.group(1))):
                msg = 'Error page does not contain %s in traceback'
                self._handlewebError(msg % repr(pattern))

    date_tolerance = 2

    def assertEqualDates(self, dt1, dt2, seconds=None):
        """Assert abs(dt1 - dt2) is within Y seconds."""
        if seconds is None:
            seconds = self.date_tolerance

        if dt1 > dt2:
            diff = dt1 - dt2
        else:
            diff = dt2 - dt1
        if not diff < datetime.timedelta(seconds=seconds):
            raise AssertionError('%r and %r are not within %r seconds.' %
                                 (dt1, dt2, seconds))


def setup_client():
    """Set up the WebCase classes to match the server's socket settings."""
    webtest.WebCase.PORT = cherrypy.server.socket_port
    webtest.WebCase.HOST = cherrypy.server.socket_host
    if cherrypy.server.ssl_certificate:
        CPWebCase.scheme = 'https'

# --------------------------- Spawning helpers --------------------------- #


class CPProcess(object):

    pid_file = os.path.join(thisdir, 'test.pid')
    config_file = os.path.join(thisdir, 'test.conf')
    config_template = """[global]
server.socket_host: '%(host)s'
server.socket_port: %(port)s
checker.on: False
log.screen: False
log.error_file: r'%(error_log)s'
log.access_file: r'%(access_log)s'
%(ssl)s
%(extra)s
"""
    error_log = os.path.join(thisdir, 'test.error.log')
    access_log = os.path.join(thisdir, 'test.access.log')

    def __init__(self, wait=False, daemonize=False, ssl=False, socket_host=None, socket_port=None):
        self.wait = wait
        self.daemonize = daemonize
        self.ssl = ssl
        self.host = socket_host or cherrypy.server.socket_host
        self.port = socket_port or cherrypy.server.socket_port

    def write_conf(self, extra=""):
        if self.ssl:
            serverpem = os.path.join(thisdir, 'test.pem')
            ssl = """
server.ssl_certificate: r'%s'
server.ssl_private_key: r'%s'
""" % (serverpem, serverpem)
        else:
            ssl = ""

        conf = self.config_template % {
            'host': self.host,
            'port': self.port,
            'error_log': self.error_log,
            'access_log': self.access_log,
            'ssl': ssl,
            'extra': extra,
            }
        f = open(self.config_file, 'wb')
        f.write(conf)
        f.close()

    def start(self, imports=None):
        """Start cherryd in a subprocess."""
        cherrypy._cpserver.wait_for_free_port(self.host, self.port)

        args = [sys.executable, os.path.join(thisdir, '..', 'cherryd'),
                '-c', self.config_file, '-p', self.pid_file]

        if not isinstance(imports, (list, tuple)):
            imports = [imports]
        for i in imports:
            if i:
                args.append('-i')
                args.append(i)

        if self.daemonize:
            args.append('-d')

        env = os.environ.copy()
        # Make sure we import the cherrypy package in which this module is defined.
        grandparentdir = os.path.abspath(os.path.join(thisdir, '..', '..'))
        if env.get('PYTHONPATH', ''):
            env['PYTHONPATH'] = os.pathsep.join((grandparentdir, env['PYTHONPATH']))
        else:
            env['PYTHONPATH'] = grandparentdir
        if self.wait:
            self.exit_code = os.spawnve(os.P_WAIT, sys.executable, args, env)
        else:
            os.spawnve(os.P_NOWAIT, sys.executable, args, env)
            cherrypy._cpserver.wait_for_occupied_port(self.host, self.port)

        # Give the engine a wee bit more time to finish STARTING
        if self.daemonize:
            time.sleep(2)
        else:
            time.sleep(1)

    def get_pid(self):
        return int(open(self.pid_file, 'rb').read())

    def join(self):
        """Wait for the process to exit."""
        try:
            try:
                # Mac, UNIX
                os.wait()
            except AttributeError:
                # Windows
                try:
                    pid = self.get_pid()
                except IOError:
                    # Assume the subprocess deleted the pidfile on shutdown.
                    pass
                else:
                    os.waitpid(pid, 0)
        except OSError, x:
            if x.args != (10, 'No child processes'):
                raise

