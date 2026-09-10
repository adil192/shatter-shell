# Retrieve the UUID from ``metadata.json``
UUID = $(shell grep -E '^[ ]*"uuid":' ./metadata.json | sed 's@^[ ]*"uuid":[ ]*"\(.\+\)",[ ]*@\1@')
VERSION = $(shell grep version tsconfig.json | awk -F\" '{print $$4}')

ifeq ($(XDG_DATA_HOME),)
XDG_DATA_HOME = $(HOME)/.local/share
endif

ifeq ($(strip $(DESTDIR)),)
INSTALLBASE = $(XDG_DATA_HOME)/gnome-shell/extensions
PLUGIN_BASE = $(XDG_DATA_HOME)/shatter-shell/launcher
SCRIPTS_BASE = $(XDG_DATA_HOME)/shatter-shell/scripts
else
INSTALLBASE = $(DESTDIR)/usr/share/gnome-shell/extensions
PLUGIN_BASE = $(DESTDIR)/usr/lib/shatter-shell/launcher
SCRIPTS_BASE = $(DESTDIR)/usr/lib/shatter-shell/scripts
endif
INSTALLNAME = $(UUID)

PROJECTS = color_dialog floating_exceptions

.PHONY: all clean install zip-file

sources = src/*.ts *.scss

all: depcheck compile

clean:
	rm -rf _build target .eslintcache tsconfig.tsbuildinfo

# Configure local settings on system
configure:
	sh scripts/configure.sh

compile: node_modules/.package-lock.json $(sources) clean
	env PROJECTS="$(PROJECTS)" ./scripts/transpile.sh

debug: depcheck compile install configure enable nested

depcheck:
	@echo depcheck
	@if ! command -v npm >/dev/null || ! command -v npx >/dev/null; then \
		echo; \
		echo 'You must install Node.js: ("sudo apt install npm" on Debian systems)'; \
		exit 1; \
	fi
node_modules/.package-lock.json: package.json package-lock.json
	npm ci

enable:
	gnome-extensions enable "shatter-shell@adilhanney.com"

disable:
	gnome-extensions disable "shatter-shell@adilhanney.com"

nested:
	@if [ "$$(gnome-shell --version | awk '{print int($$3)}')" -ge 49 ]; then \
		dbus-run-session gnome-shell --devkit --wayland; \
	else \
		dbus-run-session gnome-shell --nested --wayland; \
	fi

listen:
	journalctl -o cat -n 0 -f "$$(which gnome-shell)" | grep -v warning

local-install: depcheck compile install configure restart-shell enable

install:
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)
	mkdir -p $(INSTALLBASE)/$(INSTALLNAME) $(PLUGIN_BASE) $(SCRIPTS_BASE)
	cp -r _build/* $(INSTALLBASE)/$(INSTALLNAME)/

uninstall:
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)

restart-shell:
	@echo "Please logout and login again!"

update-repository:
	git fetch origin
	git reset --hard origin/master
	git clean -fd

zip-file: all
	cd _build && zip -qr "../$(UUID)_$(VERSION).zip" .

.NOTPARALLEL: debug local-install
