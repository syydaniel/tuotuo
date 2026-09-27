# dmgbuild settings for 坨坨.  usage: ../.venv/bin/dmgbuild -s dmg_settings.py "坨坨" Tuotuo-1.0-mac.dmg
import os
HERE = os.path.dirname(os.path.abspath(globals().get('__file__', 'dmg_settings.py')))
app = os.path.join(HERE, '..', 'app', 'build', '坨坨.app')
guide = os.path.join(HERE, '打不开看这里.txt')
format = 'UDZO'
filesystem = 'HFS+'
files = [app, guide]
symlinks = {'应用程序': '/Applications'}
icon = os.path.join(HERE, '..', 'app', 'icon', 'AppIcon.icns')
background = os.path.join(HERE, 'dmgbg.tiff')
window_rect = ((200, 120), (640, 420))
default_view = 'icon-view'
show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False
icon_size = 92
text_size = 13
icon_locations = {'坨坨.app': (170, 205), '应用程序': (470, 205), '打不开看这里.txt': (578, 352)}
