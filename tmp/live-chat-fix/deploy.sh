#!/usr/bin/env bash
set -euo pipefail

root=/var/www/drewel/drewel-admin-panel/dist
asset=index-D2UBpMxc-chatfix.js
upload="/home/ubuntu/${asset}.upload"
expected=bdd4cfc925b294ddd78e27c701fd2203ba2397a9d9d615da54c5b5dd713bc60e

actual="$(sha256sum "$upload" | cut -d' ' -f1)"
test "$actual" = "$expected"

cp "$upload" "/home/ubuntu/${asset}.check.js"
node --check "/home/ubuntu/${asset}.check.js"
test "$(grep -o 'children:"Chats"' "$upload" | wc -l)" -eq 1

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup="/var/backups/drewel-admin-chatfix/${timestamp}"
sudo mkdir -p "$backup"
sudo cp -a "$root/index.html" "$backup/index.html"
sudo cp -a "$root/assets/index-D2UBpMxc.js" "$backup/index-D2UBpMxc.js"

sudo install -o ubuntu -g ubuntu -m 0644 "$upload" "$root/assets/.${asset}.tmp"
sudo mv "$root/assets/.${asset}.tmp" "$root/assets/$asset"

sed "s/index-D2UBpMxc\.js/${asset}/" "$root/index.html" > /home/ubuntu/index.html.chatfix
test "$(grep -o "$asset" /home/ubuntu/index.html.chatfix | wc -l)" -eq 1
test "$(grep -o 'index-D2UBpMxc.js' /home/ubuntu/index.html.chatfix | wc -l)" -eq 0

sudo install -o ubuntu -g ubuntu -m 0644 /home/ubuntu/index.html.chatfix "$root/.index.html.chatfix.tmp"
sudo mv "$root/.index.html.chatfix.tmp" "$root/index.html"

rm -f "$upload" "/home/ubuntu/${asset}.check.js" /home/ubuntu/index.html.chatfix

echo "BACKUP=$backup"
echo "ACTIVE_ASSET=$asset"
sha256sum "$root/assets/$asset"
grep -o '/assets/[^"[:space:]]*\.js' "$root/index.html"
