# Retrieve the UUID from ``metadata.json``
UUID = $(shell grep -E '^[ ]*"uuid":' ./metadata.json | sed 's@^[ ]*"uuid":[ ]*"\(.\+\)",[ ]*@\1@')
VERSION_NAME = $(shell grep version-name metadata.json | awk -F\" '{print $$4}')

ifeq ($(XDG_DATA_HOME),)
XDG_DATA_HOME = $(HOME)/.local/share
endif

ifeq ($(strip $(DESTDIR)),)
INSTALLBASE = $(XDG_DATA_HOME)/gnome-shell/extensions
else
INSTALLBASE = $(DESTDIR)/usr/share/gnome-shell/extensions
endif
INSTALLNAME = $(UUID)

PROJECTS = color_dialog floating_exceptions
SOURCES = src/*.ts src/color_dialog/src/*.ts src/floating_exceptions/src/*.ts *.scss icons/*.svg schemas/*.gschema.xml metadata.json README.md

.PHONY: all clean install zip-file

all: compile

clean:
	rm -rf _build target .eslintcache tsconfig.tsbuildinfo $(UUID)_*.zip

# Configure local settings on system
configure:
	sh scripts/configure.sh

compile: _build/extension.js
_build/extension.js: node_modules/.package-lock.json $(SOURCES) scripts/transpile.sh
	env PROJECTS="$(PROJECTS)" ./scripts/transpile.sh

debug: compile install configure enable nested

node_modules/.package-lock.json: package.json package-lock.json
	npm ci

enable:
	-gnome-extensions disable "pop-shell@system76.com"
	gnome-extensions enable "$(UUID)"

disable:
	gnome-extensions disable "$(UUID)"

nested:
	@if [ "$$(gnome-shell --version | awk '{print int($$3)}')" -ge 49 ]; then \
		dbus-run-session gnome-shell --devkit --wayland; \
	else \
		dbus-run-session gnome-shell --nested --wayland; \
	fi

listen:
	journalctl -o cat -n 0 -f "$$(which gnome-shell)" | grep -v warning

local-install: compile install configure restart-shell enable

install: compile
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)
	mkdir -p $(INSTALLBASE)/$(INSTALLNAME)
	cp -r _build/* $(INSTALLBASE)/$(INSTALLNAME)/

uninstall:
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)

restart-shell:
	@echo "Please logout and login again!"

update-repository:
	git fetch origin
	git reset --hard origin/master
	git clean -fd

zip-file: $(UUID)_$(VERSION_NAME).zip
$(UUID)_$(VERSION_NAME).zip: compile
	cd _build && zip -qr "../$(UUID)_$(VERSION_NAME).zip" .

.NOTPARALLEL: debug local-install
