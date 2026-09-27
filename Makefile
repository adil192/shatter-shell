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

SOURCES = src/*.ts src/*/*.ts *.scss icons/*.svg schemas/*.gschema.xml metadata.json README.md

.PHONY: all clean configure compile debug listen install local-install local-schema uninstall zip-file lint

all: compile

clean:
	rm -rf _build schemas/gschemas.compiled target .eslintcache tsconfig.tsbuildinfo $(UUID)_*.zip

# Configure local settings on system
configure: install
	sh scripts/configure.sh

compile: _build/extension.js
_build/extension.js: node_modules/.package-lock.json $(SOURCES) scripts/transpile.sh
	./scripts/transpile.sh

debug: local-install
	@if [ "$$(gnome-shell --version | awk '{print int($$3)}')" -ge 49 ]; then \
		dbus-run-session gnome-shell --devkit --wayland; \
	else \
		dbus-run-session gnome-shell --nested --wayland; \
	fi

node_modules/.package-lock.json: package.json package-lock.json
	npm ci

listen:
	journalctl -o cat -n 0 -f "$$(which gnome-shell)" | grep -v warning

local-install: compile install local-schema configure

install: compile
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)
	mkdir -p $(INSTALLBASE)/$(INSTALLNAME)
	cp -r _build/* $(INSTALLBASE)/$(INSTALLNAME)/

local-schema: $(XDG_DATA_HOME)/glib-2.0/schemas/org.gnome.shell.extensions.shatter-shell.gschema.xml
$(XDG_DATA_HOME)/glib-2.0/schemas/org.gnome.shell.extensions.shatter-shell.gschema.xml: schemas/*.gschema.xml
	mkdir -p $(XDG_DATA_HOME)/glib-2.0/schemas/
	cp schemas/*.gschema.xml $(XDG_DATA_HOME)/glib-2.0/schemas/
	glib-compile-schemas $(XDG_DATA_HOME)/glib-2.0/schemas/

uninstall:
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)
	echo "To complete uninstallation, reset your keyboard shortcuts in GNOME Settings."

zip-file: $(UUID)_$(VERSION_NAME).zip
$(UUID)_$(VERSION_NAME).zip: compile
	cd _build && zip -qr "../$(UUID)_$(VERSION_NAME).zip" .

lint: .eslintcache
.eslintcache: node_modules/.package-lock.json $(SOURCES)
	npx eslint --cache $(shell echo $$CUSTOM_ESLINT_ARGS)
