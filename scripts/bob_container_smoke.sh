#!/bin/sh
set -e
echo "=== Method 1: piping prompt via stdin ==="
echo "Say only the word PASS." | bob --auth-method api-key --trust --accept-license --hide-intermediary-output --chat-mode ask -o text 2>&1
echo ""
echo "=== Method 2: --prompt flag (deprecated but works in 1.0.3) ==="
bob --auth-method api-key --trust --accept-license --hide-intermediary-output --chat-mode ask -o text --prompt "Say only the word PIPE." 2>&1
