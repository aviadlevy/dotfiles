# Sourced by agent hooks. `invokes <cmd> <ERE>` succeeds when <cmd> runs a command matching
# <ERE>: at a line start or after a shell separator, allowing env-var and rtk prefixes. A phrase
# that only appears inside an argument (a commit message, a grep pattern) does not count.
invokes() {
  printf '%s' "$1" | grep -Eq "(^|[;&|(])[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*(rtk[[:space:]]+)?($2)([[:space:]]|\$)"
}
