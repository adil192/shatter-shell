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

.PHONY: help clean compile debug listen install local-install uninstall zip-file lint fmt fmt-check test

# We no longer call `glib-compile-schemas`. This flag now controls whether the .gschemas.xml file is included in _build.
COMPILE_SCHEMAS = true

define HELP
Run `make local-install` to get started or make another target...

make targets:
  compile          Compiles everything into _build.
  zip-file         Compiles and produces an installable zip.
  local-install    Compiles and installs with gnome-extensions.
  install          Basic install without compiling schemas:
                   you probably want `local-install` if you're not a packager.
  uninstall        Uninstalls the extension.
  clean            Deletes build artifacts.
  debug            Starts a nested GNOME session for testing your changes.
  test             Runs unit tests.
  lint             Analyzes code with oxlint.
  fmt              Formats code with oxfmt.
  fmt-check        Checks code formatting with oxfmt.
  help             Prints this help message.
endef
export HELP
help:
	@echo "$$HELP"

clean:
	rm -rf _build schemas/gschemas.compiled target tsconfig.tsbuildinfo $(UUID)_*.zip

compile: _build/extension.js
_build/extension.js: node_modules/.package-lock.json $(SOURCES) scripts/transpile.sh
	COMPILE_SCHEMAS=$(COMPILE_SCHEMAS) ./scripts/transpile.sh

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

local-install: zip-file
	gnome-extensions install -f $(UUID)_$(VERSION_NAME).zip
	bash scripts/configure.sh

install: compile
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)
	mkdir -p $(INSTALLBASE)/$(INSTALLNAME)
	cp -r _build/* $(INSTALLBASE)/$(INSTALLNAME)/

uninstall:
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)
	echo "To complete uninstallation, reset your keyboard shortcuts in GNOME Settings."

zip-file: $(UUID)_$(VERSION_NAME).zip
$(UUID)_$(VERSION_NAME).zip: compile
	cd _build && zip -qr "../$(UUID)_$(VERSION_NAME).zip" .

lint: node_modules/.package-lock.json
	npx oxlint

fmt: node_modules/.package-lock.json
	npx oxfmt

fmt-check: node_modules/.package-lock.json
	npx oxfmt --check

# Unit tests run under Node, so they can only cover code that doesn't load GNOME libraries
test: node_modules/.package-lock.json
# 	Type-check tests
	npx tsc -p tests --noEmit 
#   Run tests
	npx tsx --test --test-reporter=dot 'tests/**/*.test.ts'
