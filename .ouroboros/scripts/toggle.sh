#!/bin/bash
cd "$(dirname "$0")/../.."
python3 .ouroboros/scripts/ouroboros_toggle.py "$@" || python .ouroboros/scripts/ouroboros_toggle.py "$@"
