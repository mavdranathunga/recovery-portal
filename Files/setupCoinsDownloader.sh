#!/bin/bash

# ============================================================
# COINS Downloader - Automated Till Setup
#
# Run as root:
#   sudo bash /coins/setupCoinsDownloader.sh
#
# Requirements:
#   - /coins/serveraddress must contain the outlet server address
#   - deshanr private SSH key must be available at:
#       /tmp/deshanr_key
#
# The deshanr key is used only to install the till's public key
# into the server and is removed after the setup.
# ============================================================

set -u

# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------

COINS_HOME="/coins"
SERVER_FILE="${COINS_HOME}/serveraddress"

TILL_KEY="${COINS_HOME}/key_zync"
TILL_PUB_KEY="${COINS_HOME}/key_zync.pub"

DOWNLOADER="${COINS_HOME}/coinsDumpDownloader"

ADMIN_USER="deshanr"
ADMIN_KEY="/tmp/deshanr_key"

ZYNC_USER="zync"
ZYNC_HOME="/home/zync"
SSH_DIR="${ZYNC_HOME}/.ssh"
AUTHORIZED_KEYS="${SSH_DIR}/authorized_keys"

# ------------------------------------------------------------
# Functions
# ------------------------------------------------------------

log()
{
    echo
    echo "============================================================"
    echo "$1"
    echo "============================================================"
}

error_exit()
{
    echo
    echo "============================================================"
    echo "ERROR: $1"
    echo "============================================================"
    cleanup
    exit 1
}

cleanup()
{
    # Remove temporary admin key
    if [ -f "$ADMIN_KEY" ]; then
        rm -f "$ADMIN_KEY"
    fi

    # Remove temporary admin public key if someone copied one
    rm -f "${ADMIN_KEY}.pub" 2>/dev/null
}

# Always clean temporary admin key when script exits
trap cleanup EXIT

# ------------------------------------------------------------
# 1. Check root
# ------------------------------------------------------------

if [ "$(id -u)" -ne 0 ]; then
    error_exit "This script must be run as root."
fi

# ------------------------------------------------------------
# 2. Check serveraddress
# ------------------------------------------------------------

log "STEP 1 - Reading outlet server address"

if [ ! -f "$SERVER_FILE" ]; then
    error_exit "$SERVER_FILE does not exist."
fi

SERVER=$(cat "$SERVER_FILE" | tr -d '[:space:]')

if [ -z "$SERVER" ]; then
    error_exit "$SERVER_FILE is empty."
fi

echo "Server address : $SERVER"

# ------------------------------------------------------------
# 3. Check deshanr key
# ------------------------------------------------------------

log "STEP 2 - Checking temporary deshanr SSH key"

if [ ! -f "$ADMIN_KEY" ]; then
    error_exit "Administrative SSH key not found at $ADMIN_KEY"
fi

chmod 600 "$ADMIN_KEY"

echo "Administrative key found."

# ------------------------------------------------------------
# 4. Test connection to server
# ------------------------------------------------------------

log "STEP 3 - Testing connection to server"

ssh \
    -i "$ADMIN_KEY" \
    -o BatchMode=yes \
    -o ConnectTimeout=10 \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    "${ADMIN_USER}@${SERVER}" \
    "echo 'SSH connection successful'" \
    || error_exit "Unable to connect to ${ADMIN_USER}@${SERVER}"

# ------------------------------------------------------------
# 5. Generate till hostname
# ------------------------------------------------------------

log "STEP 4 - Getting till hostname"

TILL_HOSTNAME=$(hostname -s)

if [ -z "$TILL_HOSTNAME" ]; then
    error_exit "Unable to determine till hostname."
fi

echo "Till hostname : $TILL_HOSTNAME"

# ------------------------------------------------------------
# 6. Generate SSH key pair
# ------------------------------------------------------------

log "STEP 5 - Generating till SSH key pair"

# Remove old keys
rm -f "$TILL_KEY" "$TILL_PUB_KEY"

ssh-keygen \
    -t ecdsa \
    -b 521 \
    -C "$TILL_HOSTNAME" \
    -f "$TILL_KEY" \
    -q \
    -N ""

if [ $? -ne 0 ]; then
    error_exit "Failed to generate SSH key pair."
fi

chmod 600 "$TILL_KEY"
chmod 644 "$TILL_PUB_KEY"

echo "Private key : $TILL_KEY"
echo "Public key  : $TILL_PUB_KEY"
echo "Comment     : $TILL_HOSTNAME"

# ------------------------------------------------------------
# 7. Read generated public key
# ------------------------------------------------------------

TILL_PUBLIC_KEY=$(cat "$TILL_PUB_KEY")

if [ -z "$TILL_PUBLIC_KEY" ]; then
    error_exit "Generated public key is empty."
fi

# ------------------------------------------------------------
# 8. Configure zync .ssh on server
# ------------------------------------------------------------

log "STEP 6 - Preparing zync SSH configuration on server"

ssh \
    -i "$ADMIN_KEY" \
    -o BatchMode=yes \
    -o ConnectTimeout=10 \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    "${ADMIN_USER}@${SERVER}" \
    "sudo -n mkdir -p '$SSH_DIR' &&
     sudo -n chown ${ZYNC_USER}:dba '$SSH_DIR' &&
     sudo -n chmod 0700 '$SSH_DIR' &&
     sudo -n touch '$AUTHORIZED_KEYS' &&
     sudo -n chown ${ZYNC_USER}:dba '$AUTHORIZED_KEYS' &&
     sudo -n chmod 0600 '$AUTHORIZED_KEYS'" \
    || error_exit "Failed to prepare zync SSH directory. Ensure $ADMIN_USER has passwordless sudo on $SERVER."

# ------------------------------------------------------------
# 9. Install till public key
# ------------------------------------------------------------

log "STEP 7 - Installing till public key on server"

# First check whether the key already exists.
KEY_EXISTS=$(
    ssh \
        -i "$ADMIN_KEY" \
        -o BatchMode=yes \
        -o ConnectTimeout=10 \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        "${ADMIN_USER}@${SERVER}" \
        "sudo -n grep -F -x '$TILL_PUBLIC_KEY' '$AUTHORIZED_KEYS' >/dev/null 2>&1; echo \$?"
)

if [ "$KEY_EXISTS" = "0" ]; then

    echo "Till public key already exists."
    echo "No duplicate key will be added."

else

    ssh \
        -i "$ADMIN_KEY" \
        -o BatchMode=yes \
        -o ConnectTimeout=10 \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        "${ADMIN_USER}@${SERVER}" \
        "echo '$TILL_PUBLIC_KEY' | sudo -n tee -a '$AUTHORIZED_KEYS' >/dev/null &&
         sudo -n chown ${ZYNC_USER}:dba '$AUTHORIZED_KEYS' &&
         sudo -n chmod 0600 '$AUTHORIZED_KEYS'" \
        || error_exit "Failed to install till public key on $SERVER."

    echo "Till public key installed successfully."

fi

# ------------------------------------------------------------
# 10. Test zync SFTP authentication
# ------------------------------------------------------------

log "STEP 8 - Testing zync SFTP authentication"

sftp \
    -b - \
    -i "$TILL_KEY" \
    -o BatchMode=yes \
    -o ConnectTimeout=10 \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    "${ZYNC_USER}@${SERVER}" \
    <<EOF
quit
EOF

if [ $? -ne 0 ]; then
    error_exit "zync SFTP authentication failed."
fi

echo "zync SFTP authentication successful."

# ------------------------------------------------------------
# 11. Check downloader
# ------------------------------------------------------------

log "STEP 9 - Checking coinsDumpDownloader"

if [ ! -f "$DOWNLOADER" ]; then
    error_exit "$DOWNLOADER does not exist."
fi

chmod +x "$DOWNLOADER"

echo "Executable permission applied."

# ------------------------------------------------------------
# 12. Run downloader
# ------------------------------------------------------------

log "STEP 10 - Running coinsDumpDownloader"

timeout 60 "$DOWNLOADER"

if [ $? -ne 0 ]; then
    error_exit "coinsDumpDownloader failed or timed out."
fi

# ------------------------------------------------------------
# 13. Verify cron
# ------------------------------------------------------------

log "STEP 11 - Verifying cron configuration"

CRON_ENTRY=$(crontab -l 2>/dev/null | grep -F "$DOWNLOADER" || true)

if [ -z "$CRON_ENTRY" ]; then
    error_exit "coinsDumpDownloader cron job was not created."
fi

echo "Cron entry:"
echo "$CRON_ENTRY"

# ------------------------------------------------------------
# 14. Final verification
# ------------------------------------------------------------

log "STEP 12 - Final verification"

echo "Till hostname : $TILL_HOSTNAME"
echo "Server        : $SERVER"
echo "Till key      : $TILL_KEY"
echo "Downloader    : $DOWNLOADER"

if [ -d "${COINS_HOME}/in" ]; then
    echo
    echo "Contents of ${COINS_HOME}/in:"
    ls -lah "${COINS_HOME}/in"
fi

DOWNLOADED_DUMP=""
if [ -f "${COINS_HOME}/in/lastfile" ]; then
    DOWNLOADED_DUMP=$(cat "${COINS_HOME}/in/lastfile" 2>/dev/null | tr -d '[:space:]')
fi
if [ -z "$DOWNLOADED_DUMP" ] && [ -d "${COINS_HOME}/in" ]; then
    DOWNLOADED_DUMP=$(ls -t "${COINS_HOME}/in"/*.dump 2>/dev/null | head -n 1 | xargs -r basename 2>/dev/null)
fi

echo
echo "============================================================"
echo "             SETUP COMPLETED SUCCESSFULLY"
echo "============================================================"
echo
echo "Till : $TILL_HOSTNAME"
echo "Server : $SERVER"
if [ -n "$DOWNLOADED_DUMP" ]; then
    echo "Downloaded dump : $DOWNLOADED_DUMP"
fi
echo
echo "SSH key authentication for zync is working."
echo "coinsDumpDownloader has been executed."
echo "Continuous cron scheduling is configured."
echo
echo "Temporary deshanr key will now be removed."
echo "============================================================"
