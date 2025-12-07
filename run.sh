# Redirect output to a log file for debugging
exec > /home/real/projects/mded/startup.log 2>&1

# Add Node/NVM to PATH
export PATH=/home/real/.nvm/versions/node/v22.21.0/bin:$PATH

echo "Date: $(date)"
echo "Starting MDed from $0"

if [ -z "$DISPLAY" ]; then
   echo "No DISPLAY variable set. Defaulting to :0"
   export DISPLAY=:0
fi

cd /home/real/projects/mded
echo "Working directory: $(pwd)"

# Run directly just in case npm has other issues, but npm start is fine if path is set
exec npm start
