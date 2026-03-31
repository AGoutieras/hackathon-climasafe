
# Refuge - React JS + Python

## Lancer le backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Lancer le frontend
```bash
cd frontend
npm install
npm run dev
```
m