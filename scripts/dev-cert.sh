#!/bin/bash
# Creates a self-signed "Clanky Dev" code-signing certificate in your login keychain, once.
# Builds signed with it keep the same identity, so macOS remembers Accessibility and Screen Recording across
# rebuilds (ad-hoc builds look like a new app every time). build.sh picks it up by name.
# macOS asks for your login password once, to trust the certificate for code signing.
set -euo pipefail
NAME="Clanky Dev"
if security find-identity -v -p codesigning | grep -q "\"$NAME\""; then echo "$NAME already exists"; exit 0; fi
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
OPENSSL=/usr/bin/openssl # LibreSSL writes a .p12 the keychain can import
"$OPENSSL" req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=$NAME" \
  -keyout "$TMP/key.pem" -out "$TMP/cert.pem" \
  -addext "keyUsage=critical,digitalSignature" -addext "extendedKeyUsage=critical,codeSigning" -addext "basicConstraints=critical,CA:false"
"$OPENSSL" pkcs12 -export -inkey "$TMP/key.pem" -in "$TMP/cert.pem" -out "$TMP/cert.p12" -passout pass:clanky
security import "$TMP/cert.p12" -k "$HOME/Library/Keychains/login.keychain-db" -P clanky -T /usr/bin/codesign
security add-trusted-cert -p codeSign -k "$HOME/Library/Keychains/login.keychain-db" "$TMP/cert.pem"
security find-identity -v -p codesigning | grep "\"$NAME\"" && echo "Done. Rebuild with ./build.sh, then grant Accessibility one last time."
