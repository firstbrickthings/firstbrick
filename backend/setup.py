"""Generate local Docker passwords without exposing or committing them."""
from pathlib import Path
import secrets

root = Path(__file__).resolve().parents[1]
path = root / '.env'
if path.exists():
    raise SystemExit('.env already exists; keeping your settings unchanged.')
password, root_password = secrets.token_hex(24), secrets.token_hex(24)
path.write_text(f'''MYSQL_PASSWORD={password}
MYSQL_ROOT_PASSWORD={root_password}
FIREBASE_PROJECT_ID=baby-one-a5cd4
ADMIN_FIREBASE_UIDS=
ALLOWED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
FIREBASE_CREDENTIALS_DIR=./secrets
''')
path.chmod(0o600)
(root / 'secrets').mkdir(exist_ok=True, mode=0o700)
print('Created private .env with random database passwords. These files are ignored by Git.')
