# Contributing

## Development Setup

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
```

## Code Style

- Python: Follow PEP 8. Type hints preferred.
- TypeScript: Use strict mode. Avoid `any` where possible.
- No commented-out code. No debug print statements.

## Pull Requests

1. Create a feature branch from `main`
2. Add tests for new functionality
3. Ensure CI passes
4. Keep changes focused — one feature per PR
