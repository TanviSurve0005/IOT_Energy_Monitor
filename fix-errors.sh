#!/bin/bash

echo "🔧 Fixing VS Code import errors..."

# Navigate to project root
cd "$(dirname "$0")"

# Create virtual environment
echo "🐍 Creating Python virtual environment..."
cd backend
python -m venv venv

# Activate based on OS
if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "darwin"* ]]; then
    source venv/bin/activate
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    venv\Scripts\activate
fi

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

# Create VS Code settings directory
echo "⚙️ Configuring VS Code settings..."
cd ..
mkdir -p .vscode

cat > .vscode/settings.json << 'EOF'
{
    "python.defaultInterpreterPath": "${workspaceFolder}/backend/venv/bin/python",
    "python.analysis.extraPaths": [
        "./backend/src",
        "./backend/venv/lib/python3.11/site-packages"
    ],
    "python.analysis.autoImportCompletions": true,
    "python.analysis.typeCheckingMode": "off",
    "python.analysis.diagnosticMode": "workspace",
    "files.exclude": {
        "**/__pycache__": true,
        "**/*.pyc": true,
        "**/venv": true,
        "**/node_modules": true
    }
}
EOF

# Fix the random import in processor.py
echo "🔨 Fixing import in processor.py..."
if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '1s/^/import random\n/' backend/src/stream_processor/processor.py
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows sed alternative
    echo "import random" | cat - backend/src/stream_processor/processor.py > temp && mv temp backend/src/stream_processor/processor.py
fi

# Fix CSS vendor prefix
echo "🎨 Fixing CSS vendor prefix..."
if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i 's/-webkit-background-clip: text;/-webkit-background-clip: text;\n  background-clip: text;/' frontend/src/styles/App.css
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows sed alternative
    powershell -Command "(Get-Content frontend/src/styles/App.css) -replace '-webkit-background-clip: text;', '-webkit-background-clip: text;`n  background-clip: text;' | Set-Content frontend/src/styles/App.css"
fi

echo ""
echo "✅ All errors fixed!"
echo ""
echo "📝 Next steps:"
echo "1. Restart VS Code"
echo "2. In VS Code, press Ctrl+Shift+P (Cmd+Shift+P on Mac)"
echo "3. Type 'Python: Select Interpreter'"
echo "4. Choose: './backend/venv/bin/python'"
echo "5. The import errors should now be gone!"
echo ""
echo "🚀 To run the project:"
echo "   docker-compose -f deployment/docker-compose.yml up --build"